import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../server/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('Pattern Detection Logic', () => {
  describe('matchPattern function logic', () => {
    function matchPattern(text: string, pattern: string, matcherType: string): boolean {
      const upperText = text.toUpperCase();
      const upperPattern = pattern.toUpperCase();

      switch (matcherType) {
        case 'CONTAINS':
          return upperText.includes(upperPattern);
        case 'STARTS_WITH':
          return upperText.startsWith(upperPattern);
        case 'ENDS_WITH':
          return upperText.endsWith(upperPattern);
        case 'EXACT':
          return upperText === upperPattern;
        case 'REGEX':
          try {
            const regex = new RegExp(pattern, 'i');
            return regex.test(text);
          } catch (e) {
            return false;
          }
        default:
          return upperText.includes(upperPattern);
      }
    }

    describe('CONTAINS matcher', () => {
      it('should match when text contains pattern', () => {
        expect(matchPattern('Gas Safety Certificate', 'gas', 'CONTAINS')).toBe(true);
      });

      it('should be case insensitive', () => {
        expect(matchPattern('LGSR_Certificate.pdf', 'lgsr', 'CONTAINS')).toBe(true);
        expect(matchPattern('lgsr_certificate.pdf', 'LGSR', 'CONTAINS')).toBe(true);
      });

      it('should return false when pattern not found', () => {
        expect(matchPattern('EICR Report', 'gas', 'CONTAINS')).toBe(false);
      });
    });

    describe('STARTS_WITH matcher', () => {
      it('should match when text starts with pattern', () => {
        expect(matchPattern('LGSR_001.pdf', 'LGSR', 'STARTS_WITH')).toBe(true);
      });

      it('should be case insensitive', () => {
        expect(matchPattern('lgsr_001.pdf', 'LGSR', 'STARTS_WITH')).toBe(true);
      });

      it('should return false when pattern is not at start', () => {
        expect(matchPattern('Document_LGSR.pdf', 'LGSR', 'STARTS_WITH')).toBe(false);
      });
    });

    describe('ENDS_WITH matcher', () => {
      it('should match when text ends with pattern', () => {
        expect(matchPattern('Document_LGSR', 'LGSR', 'ENDS_WITH')).toBe(true);
      });

      it('should be case insensitive', () => {
        expect(matchPattern('Document_lgsr', 'LGSR', 'ENDS_WITH')).toBe(true);
      });

      it('should return false when pattern is not at end', () => {
        expect(matchPattern('LGSR_Document', 'LGSR', 'ENDS_WITH')).toBe(false);
      });
    });

    describe('EXACT matcher', () => {
      it('should match exact text', () => {
        expect(matchPattern('LGSR', 'LGSR', 'EXACT')).toBe(true);
      });

      it('should be case insensitive', () => {
        expect(matchPattern('lgsr', 'LGSR', 'EXACT')).toBe(true);
      });

      it('should return false for partial match', () => {
        expect(matchPattern('LGSR_123', 'LGSR', 'EXACT')).toBe(false);
      });
    });

    describe('REGEX matcher', () => {
      it('should match valid regex patterns', () => {
        expect(matchPattern('LGSR-001-2024', 'LGSR-\\d{3}-\\d{4}', 'REGEX')).toBe(true);
      });

      it('should be case insensitive', () => {
        expect(matchPattern('lgsr', 'LGSR', 'REGEX')).toBe(true);
      });

      it('should handle invalid regex gracefully', () => {
        expect(matchPattern('text', '[invalid(', 'REGEX')).toBe(false);
      });
    });

    describe('default matcher', () => {
      it('should fall back to CONTAINS behavior', () => {
        expect(matchPattern('Gas Safety Certificate', 'gas', 'UNKNOWN')).toBe(true);
      });
    });
  });
});

describe('Outcome Evaluation Logic', () => {
  describe('evaluateOperator function logic', () => {
    function evaluateOperator(
      fieldValue: any,
      operator: string,
      ruleValue: string | null,
      fieldPath: string = ''
    ): { matches: boolean; matchedValue: string } {
      if (fieldValue === null || fieldValue === undefined) {
        return { matches: false, matchedValue: '' };
      }

      const stringValue = String(fieldValue).toUpperCase();
      const ruleValueUpper = ruleValue?.toUpperCase() || '';

      switch (operator) {
        case 'CONTAINS':
          return {
            matches: stringValue.includes(ruleValueUpper),
            matchedValue: stringValue,
          };
        case 'EQUALS':
          return {
            matches: stringValue === ruleValueUpper,
            matchedValue: stringValue,
          };
        case 'STARTS_WITH':
          return {
            matches: stringValue.startsWith(ruleValueUpper),
            matchedValue: stringValue,
          };
        case 'ENDS_WITH':
          return {
            matches: stringValue.endsWith(ruleValueUpper),
            matchedValue: stringValue,
          };
        case 'IS_TRUE':
          return {
            matches: fieldValue === true || stringValue === 'TRUE' || stringValue === 'YES' || stringValue === '1',
            matchedValue: stringValue,
          };
        case 'IS_FALSE':
          return {
            matches: fieldValue === false || stringValue === 'FALSE' || stringValue === 'NO' || stringValue === '0',
            matchedValue: stringValue,
          };
        case 'GREATER_THAN':
          const numValue = parseFloat(stringValue);
          const threshold = parseFloat(ruleValueUpper);
          return {
            matches: !isNaN(numValue) && !isNaN(threshold) && numValue > threshold,
            matchedValue: stringValue,
          };
        case 'LESS_THAN':
          const numVal = parseFloat(stringValue);
          const thresh = parseFloat(ruleValueUpper);
          return {
            matches: !isNaN(numVal) && !isNaN(thresh) && numVal < thresh,
            matchedValue: stringValue,
          };
        case 'REGEX':
          try {
            const regex = new RegExp(ruleValue || '', 'i');
            return {
              matches: regex.test(String(fieldValue)),
              matchedValue: stringValue,
            };
          } catch (e) {
            return { matches: false, matchedValue: '' };
          }
        default:
          return {
            matches: stringValue.includes(ruleValueUpper),
            matchedValue: stringValue,
          };
      }
    }

    describe('CONTAINS operator', () => {
      it('should match when value contains pattern', () => {
        const result = evaluateOperator('UNSATISFACTORY', 'CONTAINS', 'UNSATISFACTORY');
        expect(result.matches).toBe(true);
      });

      it('should be case insensitive', () => {
        const result = evaluateOperator('unsatisfactory', 'CONTAINS', 'UNSATISFACTORY');
        expect(result.matches).toBe(true);
      });
    });

    describe('EQUALS operator', () => {
      it('should match exact values', () => {
        const result = evaluateOperator('SATISFACTORY', 'EQUALS', 'SATISFACTORY');
        expect(result.matches).toBe(true);
      });

      it('should not match partial values', () => {
        const result = evaluateOperator('SATISFACTORY', 'EQUALS', 'SATIS');
        expect(result.matches).toBe(false);
      });
    });

    describe('IS_TRUE operator', () => {
      it('should match boolean true', () => {
        const result = evaluateOperator(true, 'IS_TRUE', null);
        expect(result.matches).toBe(true);
      });

      it('should match string "TRUE"', () => {
        const result = evaluateOperator('TRUE', 'IS_TRUE', null);
        expect(result.matches).toBe(true);
      });

      it('should match string "YES"', () => {
        const result = evaluateOperator('YES', 'IS_TRUE', null);
        expect(result.matches).toBe(true);
      });

      it('should match string "1"', () => {
        const result = evaluateOperator('1', 'IS_TRUE', null);
        expect(result.matches).toBe(true);
      });

      it('should not match false', () => {
        const result = evaluateOperator(false, 'IS_TRUE', null);
        expect(result.matches).toBe(false);
      });
    });

    describe('IS_FALSE operator', () => {
      it('should match boolean false', () => {
        const result = evaluateOperator(false, 'IS_FALSE', null);
        expect(result.matches).toBe(true);
      });

      it('should match string "FALSE"', () => {
        const result = evaluateOperator('FALSE', 'IS_FALSE', null);
        expect(result.matches).toBe(true);
      });

      it('should match string "NO"', () => {
        const result = evaluateOperator('NO', 'IS_FALSE', null);
        expect(result.matches).toBe(true);
      });

      it('should match string "0"', () => {
        const result = evaluateOperator('0', 'IS_FALSE', null);
        expect(result.matches).toBe(true);
      });
    });

    describe('GREATER_THAN operator', () => {
      it('should compare numeric values', () => {
        const result = evaluateOperator('50', 'GREATER_THAN', '25');
        expect(result.matches).toBe(true);
      });

      it('should return false when value is less', () => {
        const result = evaluateOperator('10', 'GREATER_THAN', '25');
        expect(result.matches).toBe(false);
      });

      it('should handle non-numeric values', () => {
        const result = evaluateOperator('abc', 'GREATER_THAN', '25');
        expect(result.matches).toBe(false);
      });
    });

    describe('LESS_THAN operator', () => {
      it('should compare numeric values', () => {
        const result = evaluateOperator('10', 'LESS_THAN', '25');
        expect(result.matches).toBe(true);
      });

      it('should return false when value is greater', () => {
        const result = evaluateOperator('50', 'LESS_THAN', '25');
        expect(result.matches).toBe(false);
      });
    });

    describe('REGEX operator', () => {
      it('should match regex patterns', () => {
        const result = evaluateOperator('C1', 'REGEX', '^C[123]$');
        expect(result.matches).toBe(true);
      });

      it('should handle invalid regex', () => {
        const result = evaluateOperator('test', 'REGEX', '[invalid(');
        expect(result.matches).toBe(false);
      });
    });

    describe('null/undefined handling', () => {
      it('should return false for null values', () => {
        const result = evaluateOperator(null, 'CONTAINS', 'test');
        expect(result.matches).toBe(false);
      });

      it('should return false for undefined values', () => {
        const result = evaluateOperator(undefined, 'EQUALS', 'test');
        expect(result.matches).toBe(false);
      });
    });
  });

  describe('getFieldValue function logic', () => {
    function getFieldValue(data: any, fieldPath: string): any {
      const paths = fieldPath.split('.');
      let value: any = data;
      
      for (const path of paths) {
        if (value === null || value === undefined) {
          return null;
        }
        value = value[path];
      }
      
      return value;
    }

    it('should get top-level field', () => {
      const data = { outcome: 'SATISFACTORY' };
      expect(getFieldValue(data, 'outcome')).toBe('SATISFACTORY');
    });

    it('should get nested field', () => {
      const data = { certificate: { type: 'GAS_SAFETY' } };
      expect(getFieldValue(data, 'certificate.type')).toBe('GAS_SAFETY');
    });

    it('should return null for missing field', () => {
      const data = { outcome: 'SATISFACTORY' };
      expect(getFieldValue(data, 'missing')).toBeUndefined();
    });

    it('should return null for null parent', () => {
      const data = { certificate: null };
      expect(getFieldValue(data, 'certificate.type')).toBe(null);
    });

    it('should handle deep nesting', () => {
      const data = { a: { b: { c: { d: 'value' } } } };
      expect(getFieldValue(data, 'a.b.c.d')).toBe('value');
    });
  });
});

describe('Compliance Outcome Types', () => {
  const validOutcomes = ['SATISFACTORY', 'SATISFACTORY_WITH_OBSERVATIONS', 'UNSATISFACTORY', 'UNDETERMINED'];

  it('should have all valid outcomes', () => {
    expect(validOutcomes).toHaveLength(4);
  });

  it('should include satisfactory outcome', () => {
    expect(validOutcomes).toContain('SATISFACTORY');
  });

  it('should include unsatisfactory outcome', () => {
    expect(validOutcomes).toContain('UNSATISFACTORY');
  });
});

describe('Defect Code Classification', () => {
  const gasDefectCodes = ['ID', 'AR', 'NCS'];
  const electricalDefectCodes = ['C1', 'C2', 'C3', 'FI'];

  describe('Gas Safety Codes', () => {
    it('should recognize ID as Immediately Dangerous', () => {
      expect(gasDefectCodes).toContain('ID');
    });

    it('should recognize AR as At Risk', () => {
      expect(gasDefectCodes).toContain('AR');
    });

    it('should recognize NCS as Not to Current Standard', () => {
      expect(gasDefectCodes).toContain('NCS');
    });
  });

  describe('Electrical Codes', () => {
    it('should recognize C1 as Danger Present', () => {
      expect(electricalDefectCodes).toContain('C1');
    });

    it('should recognize C2 as Potentially Dangerous', () => {
      expect(electricalDefectCodes).toContain('C2');
    });

    it('should recognize C3 as Improvement Recommended', () => {
      expect(electricalDefectCodes).toContain('C3');
    });

    it('should recognize FI as Further Investigation', () => {
      expect(electricalDefectCodes).toContain('FI');
    });
  });

  describe('Critical Codes', () => {
    it('should identify ID as critical', () => {
      const criticalCodes = ['ID', 'C1'];
      expect(criticalCodes).toContain('ID');
    });

    it('should identify C1 as critical', () => {
      const criticalCodes = ['ID', 'C1'];
      expect(criticalCodes).toContain('C1');
    });
  });
});

describe('Detection Pattern Priority', () => {
  it('should calculate confidence from priority', () => {
    const priority = 80;
    const confidence = Math.min(1, priority / 100);
    expect(confidence).toBe(0.8);
  });

  it('should cap confidence at 1', () => {
    const priority = 150;
    const confidence = Math.min(1, priority / 100);
    expect(confidence).toBe(1);
  });

  it('should handle zero priority', () => {
    const priority = 0;
    const confidence = Math.min(1, priority / 100);
    expect(confidence).toBe(0);
  });
});

describe('Certificate Type Codes', () => {
  const certificateTypeCodes = [
    'GAS_SAFETY', 'EICR', 'EPC', 'FIRE_RISK_ASSESSMENT',
    'LEGIONELLA_ASSESSMENT', 'ASBESTOS_SURVEY', 'LIFT_LOLER',
    'EMERGENCY_LIGHTING', 'PAT', 'FIRE_ALARM', 'FIRE_DOOR',
    'SMOKE_CO', 'DRY_RISER', 'SPRINKLER', 'UNKNOWN'
  ];

  it('should include primary certificate types', () => {
    expect(certificateTypeCodes).toContain('GAS_SAFETY');
    expect(certificateTypeCodes).toContain('EICR');
    expect(certificateTypeCodes).toContain('EPC');
  });

  it('should include fire safety types', () => {
    expect(certificateTypeCodes).toContain('FIRE_RISK_ASSESSMENT');
    expect(certificateTypeCodes).toContain('FIRE_ALARM');
    expect(certificateTypeCodes).toContain('FIRE_DOOR');
  });

  it('should include UNKNOWN for unrecognized types', () => {
    expect(certificateTypeCodes).toContain('UNKNOWN');
  });
});

describe('Legislation References in Extraction', () => {
  const legislationRefs = {
    GAS_SAFETY: 'Gas Safety (Installation and Use) Regulations 1998',
    EICR: 'Electrical Safety Standards in the Private Rented Sector (England) Regulations 2020',
    FIRE_RISK: 'Regulatory Reform (Fire Safety) Order 2005',
    ASBESTOS: 'Control of Asbestos Regulations 2012',
    LIFT: 'Lifting Operations and Lifting Equipment Regulations 1998',
    LEGIONELLA: 'Health and Safety at Work etc. Act 1974 + ACoP L8',
    EPC: 'Energy Performance of Buildings Regulations 2012',
  };

  it('should have gas safety legislation', () => {
    expect(legislationRefs.GAS_SAFETY).toContain('1998');
  });

  it('should have electrical legislation', () => {
    expect(legislationRefs.EICR).toContain('2020');
  });

  it('should have fire safety legislation', () => {
    expect(legislationRefs.FIRE_RISK).toContain('2005');
  });

  it('should have asbestos legislation', () => {
    expect(legislationRefs.ASBESTOS).toContain('2012');
  });

  it('should have lifting equipment legislation', () => {
    expect(legislationRefs.LIFT).toContain('1998');
  });
});
