const logger = {
  warn: (msg: string) => console.warn(`[geocoding] ${msg}`),
  debug: (msg: string) => console.debug(`[geocoding] ${msg}`),
  error: (msg: string, err?: unknown) => console.error(`[geocoding] ${msg}`, err || ''),
  info: (msg: string) => console.log(`[geocoding] ${msg}`)
};

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  ward?: string;
  wardCode?: string;
  lsoa?: string;
  msoa?: string;
  quality: 'exact' | 'approximate' | 'failed';
  source: 'postcodes.io' | 'manual';
}

export async function geocodePostcode(postcode: string): Promise<GeocodingResult | null> {
  if (!postcode || postcode === 'UNKNOWN') {
    return null;
  }
  
  const cleanPostcode = postcode.replace(/\s+/g, '').toUpperCase();
  
  if (cleanPostcode.length < 5) {
    logger.warn(`Invalid postcode format: ${postcode}`);
    return null;
  }
  
  try {
    const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(cleanPostcode)}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        logger.debug(`Postcode not found: ${postcode}`);
        return null;
      }
      throw new Error(`Postcodes.io API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status !== 200 || !data.result) {
      return null;
    }
    
    const result = data.result;
    
    return {
      latitude: result.latitude,
      longitude: result.longitude,
      ward: result.admin_ward,
      wardCode: result.admin_ward_code || result.codes?.admin_ward,
      lsoa: result.lsoa,
      msoa: result.msoa,
      quality: 'exact',
      source: 'postcodes.io'
    };
  } catch (error) {
    logger.error(`Geocoding error for ${postcode}:`, error);
    return null;
  }
}

export async function geocodeBulkPostcodes(postcodes: string[]): Promise<Map<string, GeocodingResult>> {
  const results = new Map<string, GeocodingResult>();
  
  const validPostcodes = postcodes
    .filter(p => p && p !== 'UNKNOWN' && p.length >= 5)
    .map(p => p.replace(/\s+/g, '').toUpperCase());
  
  if (validPostcodes.length === 0) {
    return results;
  }
  
  const batches: string[][] = [];
  for (let i = 0; i < validPostcodes.length; i += 100) {
    batches.push(validPostcodes.slice(i, i + 100));
  }
  
  for (const batch of batches) {
    try {
      const response = await fetch('https://api.postcodes.io/postcodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postcodes: batch })
      });
      
      if (!response.ok) {
        logger.error(`Bulk geocoding failed: ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      
      if (data.status === 200 && data.result) {
        for (const item of data.result) {
          if (item.result) {
            const r = item.result;
            results.set(item.query.toUpperCase().replace(/\s+/g, ''), {
              latitude: r.latitude,
              longitude: r.longitude,
              ward: r.admin_ward,
              wardCode: r.admin_ward_code || r.codes?.admin_ward,
              lsoa: r.lsoa,
              msoa: r.msoa,
              quality: 'exact',
              source: 'postcodes.io'
            });
          }
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      logger.error('Bulk geocoding batch error:', error);
    }
  }
  
  return results;
}
