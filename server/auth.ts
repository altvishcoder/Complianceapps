import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth } from "better-auth/plugins";
import { db } from "./db";
import * as schema from "@shared/schema";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;

export const auth = betterAuth({
  basePath: "/api/betterauth",
  
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),

  user: {
    modelName: "users",
    fields: {
      emailVerified: "emailVerified",
    },
    additionalFields: {
      username: {
        type: "string",
        required: true,
        input: true,
      },
      role: {
        type: "string",
        required: false,
        defaultValue: "VIEWER",
        input: false,
      },
      organisationId: {
        type: "string",
        required: true,
        input: true,
      },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },

  emailAndPassword: {
    enabled: true,
    password: {
      hash: async (password: string) => {
        return await bcrypt.hash(password, SALT_ROUNDS);
      },
      verify: async (data: { password: string; hash: string }) => {
        return await bcrypt.compare(data.password, data.hash);
      },
    },
  },

  plugins: process.env.AZURE_TENANT_ID && process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET
    ? [
        genericOAuth({
          config: [
            {
              providerId: "microsoft-entra",
              discoveryUrl: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/v2.0/.well-known/openid-configuration`,
              clientId: process.env.AZURE_CLIENT_ID,
              clientSecret: process.env.AZURE_CLIENT_SECRET,
              scopes: ["openid", "profile", "email"],
              pkce: true,
            },
          ],
        }),
      ]
    : [],

  trustedOrigins: [
    process.env.APP_URL || "http://localhost:5000",
  ],

  advanced: {
    cookiePrefix: "complianceai",
    useSecureCookies: process.env.NODE_ENV === "production",
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
