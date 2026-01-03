import type { Request, Response, NextFunction } from 'express';
import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { auth } from './auth';
import { fromNodeHeaders } from 'better-auth/node';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    name: string | null;
    email: string | null;
    role: string;
    organisationId: string | null;
  };
}

async function getBetterAuthSession(req: Request): Promise<{ userId: string } | null> {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (session?.user?.id) {
      return { userId: session.user.id };
    }
    return null;
  } catch (error) {
    console.error('BetterAuth session error:', error);
    return null;
  }
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const betterAuthSession = await getBetterAuthSession(req);
  
  if (!betterAuthSession?.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const [user] = await db.select().from(users).where(eq(users.id, betterAuthSession.userId));
    if (user) {
      req.user = {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        organisationId: user.organisationId,
      };
      return next();
    }
  } catch (error) {
    console.error('Session auth error:', error);
  }
  
  return res.status(401).json({ error: 'Authentication required' });
}

export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const betterAuthSession = await getBetterAuthSession(req);

  if (betterAuthSession?.userId) {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, betterAuthSession.userId));
      if (user) {
        req.user = {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          role: user.role,
          organisationId: user.organisationId,
        };
      }
    } catch (error) {
      console.error('Optional session auth error:', error);
    }
  }
  
  return next();
}

export function requireRole(...allowedRoles: string[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    await requireAuth(req, res, () => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const userRole = req.user.role.toUpperCase();
      const normalizedAllowed = allowedRoles.map(r => r.toUpperCase());
      
      if (!normalizedAllowed.includes(userRole)) {
        return res.status(403).json({ 
          error: 'Access denied',
          required: allowedRoles,
          current: req.user.role 
        });
      }
      
      return next();
    });
  };
}
