import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { geocodePostcode, geocodeBulkPostcodes } from '../server/geocoding';

describe('Geocoding', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('geocodePostcode', () => {
    it('should return null for empty postcode', async () => {
      const result = await geocodePostcode('');
      expect(result).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should return null for UNKNOWN postcode', async () => {
      const result = await geocodePostcode('UNKNOWN');
      expect(result).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should return null for postcode shorter than 5 chars', async () => {
      const result = await geocodePostcode('SW1');
      expect(result).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should clean and uppercase postcode before API call', async () => {
      (fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 200,
          result: {
            latitude: 51.5,
            longitude: -0.1,
            admin_ward: 'Test Ward',
            lsoa: 'Test LSOA',
            msoa: 'Test MSOA',
          },
        }),
      });

      await geocodePostcode('sw1a 1aa');
      expect(fetch).toHaveBeenCalledWith(
        'https://api.postcodes.io/postcodes/SW1A1AA'
      );
    });

    it('should return geocoding result for valid postcode', async () => {
      (fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 200,
          result: {
            latitude: 51.501364,
            longitude: -0.14189,
            admin_ward: 'St James',
            admin_ward_code: 'E05000644',
            lsoa: 'Westminster 018C',
            msoa: 'Westminster 018',
          },
        }),
      });

      const result = await geocodePostcode('SW1A 1AA');
      expect(result).not.toBeNull();
      expect(result!.latitude).toBe(51.501364);
      expect(result!.longitude).toBe(-0.14189);
      expect(result!.ward).toBe('St James');
      expect(result!.wardCode).toBe('E05000644');
      expect(result!.lsoa).toBe('Westminster 018C');
      expect(result!.msoa).toBe('Westminster 018');
      expect(result!.quality).toBe('exact');
      expect(result!.source).toBe('postcodes.io');
    });

    it('should return null for 404 response', async () => {
      (fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await geocodePostcode('XX99 9XX');
      expect(result).toBeNull();
    });

    it('should return null on API error', async () => {
      (fetch as any).mockRejectedValue(new Error('Network error'));

      const result = await geocodePostcode('SW1A 1AA');
      expect(result).toBeNull();
    });

    it('should return null when API returns non-200 status in body', async () => {
      (fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 404,
          result: null,
        }),
      });

      const result = await geocodePostcode('SW1A 1AA');
      expect(result).toBeNull();
    });

    it('should use codes.admin_ward as fallback for wardCode', async () => {
      (fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 200,
          result: {
            latitude: 51.5,
            longitude: -0.1,
            codes: {
              admin_ward: 'E05000644',
            },
          },
        }),
      });

      const result = await geocodePostcode('SW1A 1AA');
      expect(result!.wardCode).toBe('E05000644');
    });
  });

  describe('geocodeBulkPostcodes', () => {
    it('should return empty map for empty array', async () => {
      const result = await geocodeBulkPostcodes([]);
      expect(result.size).toBe(0);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should filter out invalid postcodes', async () => {
      (fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 200,
          result: [],
        }),
      });

      await geocodeBulkPostcodes(['SW1A 1AA', '', 'UNKNOWN', 'AB1']);
      
      const calledWith = JSON.parse((fetch as any).mock.calls[0][1].body);
      expect(calledWith.postcodes).toHaveLength(1);
      expect(calledWith.postcodes[0]).toBe('SW1A1AA');
    });

    it('should return empty map when all postcodes are invalid', async () => {
      const result = await geocodeBulkPostcodes(['', 'UNKNOWN', 'AB1', null as any]);
      expect(result.size).toBe(0);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should batch postcodes into groups of 100', async () => {
      const postcodes = Array.from({ length: 250 }, (_, i) => `SW${i + 10} 1AA`);
      
      (fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 200,
          result: [],
        }),
      });

      await geocodeBulkPostcodes(postcodes);
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('should map results to postcodes', async () => {
      (fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 200,
          result: [
            {
              query: 'SW1A 1AA',
              result: {
                latitude: 51.501364,
                longitude: -0.14189,
                admin_ward: 'St James',
                lsoa: 'Westminster 018C',
                msoa: 'Westminster 018',
              },
            },
            {
              query: 'EC1A 1BB',
              result: {
                latitude: 51.519,
                longitude: -0.101,
                admin_ward: 'Clerkenwell',
                lsoa: 'Islington 001A',
                msoa: 'Islington 001',
              },
            },
          ],
        }),
      });

      const result = await geocodeBulkPostcodes(['SW1A 1AA', 'EC1A 1BB']);
      expect(result.size).toBe(2);
      expect(result.get('SW1A1AA')).toBeDefined();
      expect(result.get('EC1A1BB')).toBeDefined();
      expect(result.get('SW1A1AA')!.ward).toBe('St James');
      expect(result.get('EC1A1BB')!.ward).toBe('Clerkenwell');
    });

    it('should handle null results for individual postcodes', async () => {
      (fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 200,
          result: [
            {
              query: 'SW1A 1AA',
              result: {
                latitude: 51.501364,
                longitude: -0.14189,
              },
            },
            {
              query: 'XX99 9XX',
              result: null,
            },
          ],
        }),
      });

      const result = await geocodeBulkPostcodes(['SW1A 1AA', 'XX99 9XX']);
      expect(result.size).toBe(1);
      expect(result.has('SW1A1AA')).toBe(true);
      expect(result.has('XX999XX')).toBe(false);
    });

    it('should continue on batch error', async () => {
      (fetch as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: 200,
            result: [
              {
                query: 'EC1A 1BB',
                result: {
                  latitude: 51.519,
                  longitude: -0.101,
                },
              },
            ],
          }),
        });

      const postcodes = [
        ...Array.from({ length: 100 }, () => 'SW1A 1AA'),
        ...Array.from({ length: 50 }, () => 'EC1A 1BB'),
      ];

      const result = await geocodeBulkPostcodes(postcodes);
      expect(result.size).toBe(1);
    });

    it('should handle non-ok response', async () => {
      (fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await geocodeBulkPostcodes(['SW1A 1AA']);
      expect(result.size).toBe(0);
    });
  });
});
