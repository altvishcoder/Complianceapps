import { db } from '../db';
import { sql, eq, and, gte, lt } from 'drizzle-orm';
import { logger } from '../logger';

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  maxConsecutiveChars: number;
}

const DEFAULT_POLICY: PasswordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  maxConsecutiveChars: 3,
};

export function validatePassword(password: string, policy: PasswordPolicy = DEFAULT_POLICY): PasswordValidationResult {
  const errors: string[] = [];
  
  if (password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters long`);
  }
  
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (policy.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (policy.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*...)');
  }
  
  // Check for consecutive repeated characters
  if (policy.maxConsecutiveChars > 0) {
    const consecutivePattern = new RegExp(`(.)\\1{${policy.maxConsecutiveChars},}`);
    if (consecutivePattern.test(password)) {
      errors.push(`Password cannot contain more than ${policy.maxConsecutiveChars} consecutive identical characters`);
    }
  }
  
  // Check for common weak passwords
  const weakPasswords = ['password', '12345678', 'qwerty', 'admin123', 'letmein', 'welcome'];
  if (weakPasswords.some(weak => password.toLowerCase().includes(weak))) {
    errors.push('Password is too common or contains weak patterns');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

// Login attempt tracking using PostgreSQL for persistence
const LOCKOUT_CONFIG = {
  maxAttempts: 5,
  lockoutDurationMinutes: 15,
  attemptWindowMinutes: 30,
};

// Ensure login_attempts table exists
async function ensureLoginAttemptsTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS login_attempts (
        username TEXT PRIMARY KEY,
        attempts INTEGER NOT NULL DEFAULT 1,
        first_attempt_at TIMESTAMP NOT NULL DEFAULT NOW(),
        locked_until TIMESTAMP
      )
    `);
  } catch (error) {
    logger.error({ error }, 'Failed to create login_attempts table');
  }
}

// Initialize table on module load
ensureLoginAttemptsTable().catch(() => {});

export async function checkLoginLockout(username: string): Promise<{ isLocked: boolean; remainingMinutes?: number; attemptsRemaining?: number }> {
  const lowerUsername = username.toLowerCase();
  const now = new Date();
  
  try {
    const result = await db.execute(sql`
      SELECT attempts, first_attempt_at, locked_until
      FROM login_attempts
      WHERE username = ${lowerUsername}
    `);
    
    if (result.rows.length === 0) {
      return { isLocked: false, attemptsRemaining: LOCKOUT_CONFIG.maxAttempts };
    }
    
    const record = result.rows[0] as any;
    const lockedUntil = record.locked_until ? new Date(record.locked_until) : null;
    const firstAttemptAt = new Date(record.first_attempt_at);
    
    // Check if locked out
    if (lockedUntil && lockedUntil > now) {
      const remainingMs = lockedUntil.getTime() - now.getTime();
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      return { isLocked: true, remainingMinutes };
    }
    
    // Reset if outside attempt window or lockout expired
    const windowEnd = new Date(firstAttemptAt.getTime() + LOCKOUT_CONFIG.attemptWindowMinutes * 60000);
    if (now > windowEnd || (lockedUntil && lockedUntil <= now)) {
      await db.execute(sql`DELETE FROM login_attempts WHERE username = ${lowerUsername}`);
      return { isLocked: false, attemptsRemaining: LOCKOUT_CONFIG.maxAttempts };
    }
    
    return {
      isLocked: false,
      attemptsRemaining: Math.max(0, LOCKOUT_CONFIG.maxAttempts - record.attempts),
    };
  } catch (error) {
    logger.error({ error }, 'Failed to check login lockout');
    return { isLocked: false, attemptsRemaining: LOCKOUT_CONFIG.maxAttempts };
  }
}

export async function recordFailedLogin(username: string): Promise<{ isLocked: boolean; remainingMinutes?: number }> {
  const lowerUsername = username.toLowerCase();
  const now = new Date();
  
  try {
    // Upsert login attempt
    await db.execute(sql`
      INSERT INTO login_attempts (username, attempts, first_attempt_at)
      VALUES (${lowerUsername}, 1, ${now})
      ON CONFLICT (username) DO UPDATE SET
        attempts = CASE 
          WHEN login_attempts.first_attempt_at < ${new Date(now.getTime() - LOCKOUT_CONFIG.attemptWindowMinutes * 60000)}
          THEN 1
          ELSE login_attempts.attempts + 1
        END,
        first_attempt_at = CASE
          WHEN login_attempts.first_attempt_at < ${new Date(now.getTime() - LOCKOUT_CONFIG.attemptWindowMinutes * 60000)}
          THEN ${now}
          ELSE login_attempts.first_attempt_at
        END
    `);
    
    // Check if we need to lock
    const result = await db.execute(sql`
      SELECT attempts FROM login_attempts WHERE username = ${lowerUsername}
    `);
    
    if (result.rows.length > 0) {
      const attempts = (result.rows[0] as any).attempts;
      if (attempts >= LOCKOUT_CONFIG.maxAttempts) {
        const lockedUntil = new Date(now.getTime() + LOCKOUT_CONFIG.lockoutDurationMinutes * 60000);
        await db.execute(sql`
          UPDATE login_attempts SET locked_until = ${lockedUntil} WHERE username = ${lowerUsername}
        `);
        return { isLocked: true, remainingMinutes: LOCKOUT_CONFIG.lockoutDurationMinutes };
      }
    }
    
    return { isLocked: false };
  } catch (error) {
    logger.error({ error }, 'Failed to record failed login');
    return { isLocked: false };
  }
}

export async function clearLoginAttempts(username: string): Promise<void> {
  try {
    await db.execute(sql`DELETE FROM login_attempts WHERE username = ${username.toLowerCase()}`);
  } catch (error) {
    logger.error({ error }, 'Failed to clear login attempts');
  }
}

export function getPasswordPolicyDescription(): string[] {
  return [
    `At least ${DEFAULT_POLICY.minLength} characters`,
    'At least one uppercase letter (A-Z)',
    'At least one lowercase letter (a-z)',
    'At least one number (0-9)',
    'At least one special character (!@#$%^&*...)',
    `No more than ${DEFAULT_POLICY.maxConsecutiveChars} consecutive identical characters`,
  ];
}
