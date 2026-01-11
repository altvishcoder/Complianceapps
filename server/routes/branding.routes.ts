import { Router, Request, Response } from "express";
import { db } from "../db";
import { organizationBranding } from "@shared/schema";
import { eq } from "drizzle-orm";

export const brandingRouter = Router();

const DEFAULT_BRANDING = {
  appName: 'SocialComply',
  primaryColor: '#3b82f6',
  secondaryColor: '#1e40af',
  accentColor: '#60a5fa',
  fontFamily: 'Inter',
  metaTitle: 'SocialComply - Compliance Management',
  metaDescription: 'UK Social Housing Compliance Management Platform',
  footerText: 'SocialComply - Keeping Homes Safe',
};

brandingRouter.get("/branding", async (req: Request, res: Response) => {
  try {
    const orgId = req.query.org as string || 'default';
    
    try {
      const [branding] = await db
        .select()
        .from(organizationBranding)
        .where(eq(organizationBranding.organisationId, orgId))
        .limit(1);
      
      if (!branding) {
        const [defaultBranding] = await db
          .select()
          .from(organizationBranding)
          .where(eq(organizationBranding.organisationId, 'default'))
          .limit(1);
        
        if (defaultBranding) {
          return res.json(defaultBranding);
        }
        
        return res.json(DEFAULT_BRANDING);
      }
      
      res.json(branding);
    } catch (dbError: any) {
      if (dbError?.message?.includes('does not exist') || dbError?.code === '42P01') {
        return res.json(DEFAULT_BRANDING);
      }
      throw dbError;
    }
  } catch (error) {
    console.error("Error fetching branding:", error);
    res.json(DEFAULT_BRANDING);
  }
});

brandingRouter.get("/assets/config", async (req: Request, res: Response) => {
  try {
    const config = {
      assetsBaseUrl: process.env.ASSETS_BASE_URL || '/assets',
      objectStorageConfigured: !!(process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID),
      mapTiles: {
        light: process.env.VITE_TILE_SOURCE_LIGHT || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        dark: process.env.VITE_TILE_SOURCE_DARK || 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        selfHosted: !!process.env.VITE_TILE_SOURCE_SELF_HOSTED,
      },
      markers: {
        baseUrl: '/assets/leaflet',
      },
    };
    res.json(config);
  } catch (error) {
    console.error("Error fetching assets config:", error);
    res.status(500).json({ error: "Failed to fetch assets configuration" });
  }
});
