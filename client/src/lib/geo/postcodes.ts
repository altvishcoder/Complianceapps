export interface GeocodeResult {
  postcode: string;
  latitude: number;
  longitude: number;
  ward: string;
  wardCode: string;
  lsoa: string;
  msoa: string;
  region: string;
  country: string;
}

interface PostcodesApiResult {
  postcode: string;
  longitude: number;
  latitude: number;
  admin_ward?: string;
  lsoa?: string;
  msoa?: string;
  region?: string;
  country?: string;
  codes?: {
    admin_ward?: string;
  };
}

interface PostcodesApiResponse {
  status: number;
  result: PostcodesApiResult | null;
}

interface BulkPostcodesApiResponse {
  status: number;
  result: Array<{
    query: string;
    result: PostcodesApiResult | null;
  }>;
}

export async function lookupPostcode(postcode: string): Promise<GeocodeResult | null> {
  try {
    const cleanPostcode = postcode.replace(/\s+/g, '').toUpperCase();
    const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(cleanPostcode)}`);
    
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Postcodes.io error: ${response.status}`);
    }
    
    const data: PostcodesApiResponse = await response.json();
    
    if (!data.result) return null;
    
    return {
      postcode: data.result.postcode,
      latitude: data.result.latitude,
      longitude: data.result.longitude,
      ward: data.result.admin_ward || '',
      wardCode: data.result.codes?.admin_ward || '',
      lsoa: data.result.lsoa || '',
      msoa: data.result.msoa || '',
      region: data.result.region || '',
      country: data.result.country || 'England',
    };
  } catch (error) {
    console.error(`Failed to lookup postcode ${postcode}:`, error);
    return null;
  }
}

export async function bulkLookupPostcodes(postcodes: string[]): Promise<Map<string, GeocodeResult>> {
  const results = new Map<string, GeocodeResult>();
  
  if (postcodes.length === 0) return results;
  
  const cleanPostcodes = postcodes.map(p => p.replace(/\s+/g, '').toUpperCase());
  const uniquePostcodes = [...new Set(cleanPostcodes)];
  
  const batchSize = 100;
  
  for (let i = 0; i < uniquePostcodes.length; i += batchSize) {
    const batch = uniquePostcodes.slice(i, i + batchSize);
    
    try {
      const response = await fetch('https://api.postcodes.io/postcodes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ postcodes: batch }),
      });
      
      if (!response.ok) {
        throw new Error(`Postcodes.io bulk error: ${response.status}`);
      }
      
      const data: BulkPostcodesApiResponse = await response.json();
      
      for (const item of data.result) {
        if (item.result) {
          results.set(item.query.replace(/\s+/g, '').toUpperCase(), {
            postcode: item.result.postcode,
            latitude: item.result.latitude,
            longitude: item.result.longitude,
            ward: item.result.admin_ward || '',
            wardCode: item.result.codes?.admin_ward || '',
            lsoa: item.result.lsoa || '',
            msoa: item.result.msoa || '',
            region: item.result.region || '',
            country: item.result.country || 'England',
          });
        }
      }
      
      if (i + batchSize < uniquePostcodes.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`Failed to bulk lookup postcodes (batch ${i}):`, error);
    }
  }
  
  return results;
}

export function isValidUKPostcode(postcode: string): boolean {
  const regex = /^([A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2})$/i;
  return regex.test(postcode.trim());
}
