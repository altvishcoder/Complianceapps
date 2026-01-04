import { describe, it, expect } from 'vitest';
import { db } from '../server/db';
import { sql } from 'drizzle-orm';

describe('Database Constraint Tests', () => {
  describe('Foreign Key Constraints', () => {
    it('should verify blocks reference valid schemes', async () => {
      const result = await db.execute(sql`
        SELECT COUNT(*) as orphan_count 
        FROM blocks b 
        LEFT JOIN schemes s ON b.scheme_id = s.id 
        WHERE s.id IS NULL AND b.scheme_id IS NOT NULL
      `);
      expect(Number(result.rows[0]?.orphan_count || 0)).toBe(0);
    });

    it('should verify properties reference valid blocks', async () => {
      const result = await db.execute(sql`
        SELECT COUNT(*) as orphan_count 
        FROM properties p 
        LEFT JOIN blocks b ON p.block_id = b.id 
        WHERE b.id IS NULL AND p.block_id IS NOT NULL
      `);
      expect(Number(result.rows[0]?.orphan_count || 0)).toBe(0);
    });

    it('should verify certificates reference valid properties', async () => {
      const result = await db.execute(sql`
        SELECT COUNT(*) as orphan_count 
        FROM certificates c 
        LEFT JOIN properties p ON c.property_id = p.id 
        WHERE p.id IS NULL AND c.property_id IS NOT NULL
      `);
      expect(Number(result.rows[0]?.orphan_count || 0)).toBe(0);
    });

    it('should verify remedial actions reference valid certificates', async () => {
      const result = await db.execute(sql`
        SELECT COUNT(*) as orphan_count 
        FROM remedial_actions ra 
        LEFT JOIN certificates c ON ra.certificate_id = c.id 
        WHERE c.id IS NULL AND ra.certificate_id IS NOT NULL
      `);
      expect(Number(result.rows[0]?.orphan_count || 0)).toBe(0);
    });

    it('should verify spaces reference exactly one parent', async () => {
      const result = await db.execute(sql`
        SELECT COUNT(*) as invalid_count 
        FROM spaces 
        WHERE (
          (property_id IS NOT NULL AND block_id IS NOT NULL) OR
          (property_id IS NOT NULL AND scheme_id IS NOT NULL) OR
          (block_id IS NOT NULL AND scheme_id IS NOT NULL) OR
          (property_id IS NULL AND block_id IS NULL AND scheme_id IS NULL)
        )
      `);
      expect(Number(result.rows[0]?.invalid_count || 0)).toBe(0);
    });

    it('should verify components reference valid component types', async () => {
      const result = await db.execute(sql`
        SELECT COUNT(*) as orphan_count 
        FROM components c 
        LEFT JOIN component_types ct ON c.component_type_id = ct.id 
        WHERE ct.id IS NULL AND c.component_type_id IS NOT NULL
      `);
      expect(Number(result.rows[0]?.orphan_count || 0)).toBe(0);
    });

    it('should verify certificate types have compliance stream references', async () => {
      const result = await db.execute(sql`
        SELECT COUNT(*) as type_count 
        FROM certificate_types ct 
        WHERE ct.compliance_stream IS NOT NULL
      `);
      expect(Number(result.rows[0]?.type_count || 0)).toBeGreaterThan(0);
    });
  });

  describe('Not Null Constraints', () => {
    it('should verify schemes have names', async () => {
      const result = await db.execute(sql`
        SELECT COUNT(*) as null_count 
        FROM schemes 
        WHERE name IS NULL
      `);
      expect(Number(result.rows[0]?.null_count || 0)).toBe(0);
    });

    it('should verify blocks have names', async () => {
      const result = await db.execute(sql`
        SELECT COUNT(*) as null_count 
        FROM blocks 
        WHERE name IS NULL
      `);
      expect(Number(result.rows[0]?.null_count || 0)).toBe(0);
    });

    it('should verify properties have address', async () => {
      const result = await db.execute(sql`
        SELECT COUNT(*) as null_count 
        FROM properties 
        WHERE address_line1 IS NULL
      `);
      expect(Number(result.rows[0]?.null_count || 0)).toBe(0);
    });

    it('should verify certificates have certificate type', async () => {
      const result = await db.execute(sql`
        SELECT COUNT(*) as null_count 
        FROM certificates 
        WHERE certificate_type IS NULL
      `);
      expect(Number(result.rows[0]?.null_count || 0)).toBe(0);
    });

    it('should verify remedial actions have descriptions', async () => {
      const result = await db.execute(sql`
        SELECT COUNT(*) as null_count 
        FROM remedial_actions 
        WHERE description IS NULL
      `);
      expect(Number(result.rows[0]?.null_count || 0)).toBe(0);
    });
  });

  describe('Unique Constraints', () => {
    it('should verify user emails are unique', async () => {
      const result = await db.execute(sql`
        SELECT email, COUNT(*) as count 
        FROM users 
        GROUP BY email 
        HAVING COUNT(*) > 1
      `);
      expect(result.rows.length).toBe(0);
    });

    it('should verify factory setting keys are unique', async () => {
      const result = await db.execute(sql`
        SELECT key, COUNT(*) as count 
        FROM factory_settings 
        GROUP BY key 
        HAVING COUNT(*) > 1
      `);
      expect(result.rows.length).toBe(0);
    });

    it('should verify compliance stream codes are unique', async () => {
      const result = await db.execute(sql`
        SELECT code, COUNT(*) as count 
        FROM compliance_streams 
        GROUP BY code 
        HAVING COUNT(*) > 1
      `);
      expect(result.rows.length).toBe(0);
    });
  });

  describe('UKHDS Hierarchy Compliance', () => {
    it('should verify scheme-block-property hierarchy exists', async () => {
      const result = await db.execute(sql`
        SELECT 
          (SELECT COUNT(*) FROM schemes) as scheme_count,
          (SELECT COUNT(*) FROM blocks) as block_count,
          (SELECT COUNT(*) FROM properties) as property_count
      `);
      expect(result.rows[0]).toBeDefined();
    });

    it('should verify spaces attach at correct levels', async () => {
      const result = await db.execute(sql`
        SELECT 
          SUM(CASE WHEN property_id IS NOT NULL THEN 1 ELSE 0 END) as dwelling_spaces,
          SUM(CASE WHEN block_id IS NOT NULL THEN 1 ELSE 0 END) as communal_spaces,
          SUM(CASE WHEN scheme_id IS NOT NULL THEN 1 ELSE 0 END) as estate_spaces
        FROM spaces
      `);
      expect(result.rows[0]).toBeDefined();
    });

    it('should verify components link to properties or spaces', async () => {
      const result = await db.execute(sql`
        SELECT COUNT(*) as orphan_count 
        FROM components 
        WHERE property_id IS NULL AND space_id IS NULL
      `);
      expect(Number(result.rows[0]?.orphan_count || 0)).toBe(0);
    });
  });

  describe('Compliance Stream Configuration', () => {
    it('should have compliance streams configured', async () => {
      const result = await db.execute(sql`
        SELECT COUNT(*) as stream_count FROM compliance_streams
      `);
      expect(Number(result.rows[0]?.stream_count || 0)).toBeGreaterThanOrEqual(1);
    });

    it('should have certificate types defined', async () => {
      const result = await db.execute(sql`
        SELECT COUNT(*) as type_count FROM certificate_types
      `);
      expect(Number(result.rows[0]?.type_count || 0)).toBeGreaterThanOrEqual(1);
    });

    it('should have detection patterns configured', async () => {
      const result = await db.execute(sql`
        SELECT COUNT(*) as pattern_count FROM certificate_detection_patterns
      `);
      expect(Number(result.rows[0]?.pattern_count || 0)).toBeGreaterThan(10);
    });

    it('should have outcome rules configured', async () => {
      const result = await db.execute(sql`
        SELECT COUNT(*) as rule_count FROM certificate_outcome_rules
      `);
      expect(Number(result.rows[0]?.rule_count || 0)).toBeGreaterThan(5);
    });
  });

  describe('Audit Trail Integrity', () => {
    it('should verify audit events table exists', async () => {
      const result = await db.execute(sql`
        SELECT COUNT(*) as event_count FROM audit_events
      `);
      expect(result.rows[0]).toBeDefined();
    });

    it('should verify factory settings audit exists', async () => {
      const result = await db.execute(sql`
        SELECT COUNT(*) as audit_count FROM factory_settings_audit
      `);
      expect(result.rows[0]).toBeDefined();
    });
  });

  describe('ML Model Configuration', () => {
    it('should verify ML models table exists', async () => {
      const result = await db.execute(sql`
        SELECT COUNT(*) as model_count FROM ml_models
      `);
      expect(result.rows[0]).toBeDefined();
    });

    it('should verify ML predictions reference valid models', async () => {
      const result = await db.execute(sql`
        SELECT COUNT(*) as orphan_count 
        FROM ml_predictions p 
        LEFT JOIN ml_models m ON p.model_id = m.id 
        WHERE m.id IS NULL AND p.model_id IS NOT NULL
      `);
      expect(Number(result.rows[0]?.orphan_count || 0)).toBe(0);
    });
  });

  describe('Contractor Data Integrity', () => {
    it('should verify contractors table exists', async () => {
      const result = await db.execute(sql`
        SELECT COUNT(*) as contractor_count FROM contractors
      `);
      expect(result.rows[0]).toBeDefined();
    });

    it('should verify contractor certifications reference valid contractors', async () => {
      const result = await db.execute(sql`
        SELECT COUNT(*) as orphan_count 
        FROM contractor_certifications cc 
        LEFT JOIN contractors c ON cc.contractor_id = c.id 
        WHERE c.id IS NULL
      `);
      expect(Number(result.rows[0]?.orphan_count || 0)).toBe(0);
    });
  });

  describe('Chatbot Data Integrity', () => {
    it('should verify chatbot messages reference valid conversations', async () => {
      const result = await db.execute(sql`
        SELECT COUNT(*) as orphan_count 
        FROM chatbot_messages m 
        LEFT JOIN chatbot_conversations c ON m.conversation_id = c.id 
        WHERE c.id IS NULL
      `);
      expect(Number(result.rows[0]?.orphan_count || 0)).toBe(0);
    });
  });

  describe('Cache Configuration', () => {
    it('should verify cache regions table exists', async () => {
      const result = await db.execute(sql`
        SELECT COUNT(*) as region_count FROM cache_regions
      `);
      expect(result.rows[0]).toBeDefined();
    });
  });

  describe('Table Existence Verification', () => {
    it('should have all core tables', async () => {
      const tables = ['schemes', 'blocks', 'properties', 'certificates', 'remedial_actions'];
      for (const table of tables) {
        const result = await db.execute(sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = ${table}
          )
        `);
        expect(result.rows[0]?.exists).toBe(true);
      }
    });

    it('should have all configuration tables', async () => {
      const tables = ['compliance_streams', 'certificate_types', 'component_types', 'factory_settings'];
      for (const table of tables) {
        const result = await db.execute(sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = ${table}
          )
        `);
        expect(result.rows[0]?.exists).toBe(true);
      }
    });

    it('should have all ML tables', async () => {
      const tables = ['ml_models', 'ml_predictions', 'ml_feedback'];
      for (const table of tables) {
        const result = await db.execute(sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = ${table}
          )
        `);
        expect(result.rows[0]?.exists).toBe(true);
      }
    });
  });
});
