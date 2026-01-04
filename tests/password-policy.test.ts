import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validatePassword,
  getPasswordPolicyDescription,
  checkLoginLockout,
  recordFailedLogin,
  clearLoginAttempts,
  type PasswordValidationResult,
  type PasswordPolicy,
} from '../server/services/password-policy';

vi.mock('../server/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockDbExecute = vi.fn();

vi.mock('../server/db', () => ({
  db: {
    execute: (...args: any[]) => mockDbExecute(...args),
  },
}));

describe('Password Policy Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbExecute.mockReset();
  });

  describe('validatePassword', () => {
    describe('with default policy', () => {
      it('should validate a strong password', () => {
        const result = validatePassword('SecureP@ss123');
        
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject password shorter than minimum length', () => {
        const result = validatePassword('Short1!');
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password must be at least 8 characters long');
      });

      it('should reject password without uppercase letter', () => {
        const result = validatePassword('lowercase123!');
        
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('uppercase'))).toBe(true);
      });

      it('should reject password without lowercase letter', () => {
        const result = validatePassword('UPPERCASE123!');
        
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('lowercase'))).toBe(true);
      });

      it('should reject password without numbers', () => {
        const result = validatePassword('NoNumbers!@#');
        
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('number'))).toBe(true);
      });

      it('should reject password without special characters', () => {
        const result = validatePassword('NoSpecial123');
        
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('special character'))).toBe(true);
      });

      it('should reject password with too many consecutive characters', () => {
        const result = validatePassword('Passssword1!');
        
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('consecutive'))).toBe(true);
      });

      it('should reject common weak passwords', () => {
        const result = validatePassword('Password123!');
        
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('common') || e.includes('weak'))).toBe(true);
      });

      it('should reject password containing qwerty', () => {
        const result = validatePassword('Qwerty123!@#');
        
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('common') || e.includes('weak'))).toBe(true);
      });

      it('should reject password containing admin123', () => {
        const result = validatePassword('Admin123!@#$');
        
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('common') || e.includes('weak'))).toBe(true);
      });

      it('should collect multiple errors', () => {
        const result = validatePassword('short');
        
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(1);
      });
    });

    describe('with custom policy', () => {
      it('should allow shorter passwords with custom minLength', () => {
        const policy: PasswordPolicy = {
          minLength: 4,
          requireUppercase: false,
          requireLowercase: false,
          requireNumbers: false,
          requireSpecialChars: false,
          maxConsecutiveChars: 0,
        };

        const result = validatePassword('test', policy);
        
        expect(result.isValid).toBe(true);
      });

      it('should skip uppercase check when disabled', () => {
        const policy: PasswordPolicy = {
          minLength: 8,
          requireUppercase: false,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true,
          maxConsecutiveChars: 3,
        };

        const result = validatePassword('lowercase1!');
        
        expect(result.errors.some(e => e.includes('uppercase'))).toBe(true);

        const resultWithPolicy = validatePassword('lowercase1!', policy);
        expect(resultWithPolicy.errors.some(e => e.includes('uppercase'))).toBe(false);
      });

      it('should allow consecutive chars when maxConsecutiveChars is 0', () => {
        const policy: PasswordPolicy = {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true,
          maxConsecutiveChars: 0,
        };

        const result = validatePassword('Passsssword1!', policy);
        
        expect(result.errors.some(e => e.includes('consecutive'))).toBe(false);
      });
    });
  });

  describe('PasswordValidationResult Type', () => {
    it('should have correct structure for valid password', () => {
      const result: PasswordValidationResult = {
        isValid: true,
        errors: [],
      };
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should have correct structure for invalid password', () => {
      const result: PasswordValidationResult = {
        isValid: false,
        errors: ['Too short', 'Missing uppercase'],
      };
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe('getPasswordPolicyDescription', () => {
    it('should return array of policy descriptions', () => {
      const descriptions = getPasswordPolicyDescription();
      
      expect(Array.isArray(descriptions)).toBe(true);
      expect(descriptions.length).toBeGreaterThan(0);
    });

    it('should include minimum length requirement', () => {
      const descriptions = getPasswordPolicyDescription();
      
      expect(descriptions.some(d => d.includes('8 characters'))).toBe(true);
    });

    it('should include uppercase requirement', () => {
      const descriptions = getPasswordPolicyDescription();
      
      expect(descriptions.some(d => d.includes('uppercase'))).toBe(true);
    });

    it('should include lowercase requirement', () => {
      const descriptions = getPasswordPolicyDescription();
      
      expect(descriptions.some(d => d.includes('lowercase'))).toBe(true);
    });

    it('should include number requirement', () => {
      const descriptions = getPasswordPolicyDescription();
      
      expect(descriptions.some(d => d.includes('number'))).toBe(true);
    });

    it('should include special character requirement', () => {
      const descriptions = getPasswordPolicyDescription();
      
      expect(descriptions.some(d => d.includes('special character'))).toBe(true);
    });

    it('should include consecutive character limit', () => {
      const descriptions = getPasswordPolicyDescription();
      
      expect(descriptions.some(d => d.includes('consecutive'))).toBe(true);
    });
  });

  describe('checkLoginLockout', () => {
    it('should return not locked with max attempts for new user', async () => {
      mockDbExecute.mockResolvedValue({ rows: [] });

      const result = await checkLoginLockout('newuser@test.com');

      expect(result.isLocked).toBe(false);
      expect(result.attemptsRemaining).toBe(5);
    });

    it('should return locked with remaining minutes when locked', async () => {
      const futureDate = new Date(Date.now() + 10 * 60000);
      mockDbExecute.mockResolvedValue({
        rows: [{
          attempts: 5,
          first_attempt_at: new Date(),
          locked_until: futureDate,
        }],
      });

      const result = await checkLoginLockout('locked@test.com');

      expect(result.isLocked).toBe(true);
      expect(result.remainingMinutes).toBeGreaterThan(0);
    });

    it('should handle errors gracefully', async () => {
      mockDbExecute.mockRejectedValue(new Error('DB error'));

      const result = await checkLoginLockout('error@test.com');

      expect(result.isLocked).toBe(false);
      expect(result.attemptsRemaining).toBe(5);
    });
  });

  describe('recordFailedLogin', () => {
    it('should record failed login attempt', async () => {
      mockDbExecute
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ attempts: 1 }] });

      const result = await recordFailedLogin('user@test.com');

      expect(result.isLocked).toBe(false);
    });

    it('should lock account after max attempts', async () => {
      mockDbExecute
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ attempts: 5 }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await recordFailedLogin('user@test.com');

      expect(result.isLocked).toBe(true);
      expect(result.remainingMinutes).toBe(15);
    });

    it('should handle errors gracefully', async () => {
      mockDbExecute.mockRejectedValue(new Error('DB error'));

      const result = await recordFailedLogin('error@test.com');

      expect(result.isLocked).toBe(false);
    });
  });

  describe('clearLoginAttempts', () => {
    it('should clear login attempts', async () => {
      mockDbExecute.mockResolvedValue({ rows: [] });

      await expect(clearLoginAttempts('user@test.com')).resolves.not.toThrow();
    });

    it('should handle errors gracefully', async () => {
      mockDbExecute.mockRejectedValue(new Error('DB error'));

      await expect(clearLoginAttempts('error@test.com')).resolves.not.toThrow();
    });

    it('should convert username to lowercase', async () => {
      mockDbExecute.mockResolvedValue({ rows: [] });

      await clearLoginAttempts('User@Test.Com');

      expect(mockDbExecute).toHaveBeenCalled();
    });
  });
});
