import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import type { Express, Request, Response, NextFunction } from 'express';
import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

const PgSession = connectPgSimple(session);

declare module 'express-session' {
  interface SessionData {
    userId: string;
    username: string;
    role: string;
    organisationId: string | null;
  }
}

export function setupSession(app: Express) {
  const sessionSecret = process.env.SESSION_SECRET;
  
  if (!sessionSecret) {
    console.warn('[SECURITY WARNING] SESSION_SECRET environment variable not set. Using generated fallback - this is NOT secure for production!');
  }
  
  const secret = sessionSecret || require('crypto').randomBytes(32).toString('hex');
  
  app.use(
    session({
      store: new PgSession({
        conString: process.env.DATABASE_URL,
        tableName: 'user_sessions',
        createTableIfMissing: true,
      }),
      secret: secret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax',
      },
      name: 'compliance.sid',
    })
  );
}

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

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  // Only accept session-based authentication for security
  // The X-User-Id header fallback has been removed to prevent bypass attacks
  if (req.session?.userId) {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.session.userId));
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
  }
  
  return res.status(401).json({ error: 'Authentication required' });
}

export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  // Only accept session-based authentication for security
  if (req.session?.userId) {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.session.userId));
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
