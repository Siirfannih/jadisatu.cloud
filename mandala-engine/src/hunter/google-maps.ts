import { getSupabase } from '../memory/supabase-client.js';

/**
 * Google Maps Places API Integration.
 *
 * Discovers businesses by category + location using Google Places API.
 * Stores raw business data in mandala_hunter_prospects.
 */

export interface PlaceResult {
  place_id: string;
  name: string;
  address: string;
  phone?: string;
  rating?: number;
  review_count?: number;
  website?: string;
  types: string[];
  location: { lat: number; lng: number };
  business_hours?: string;
}

export interface PlaceReview {
  author: string;
  rating: number;
  text: string;
  time: number;
  relative_time: string;
}

export class GoogleMapsClient {
  private static instance: GoogleMapsClient;
  private apiKey: string;

  private constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[google-maps] GOOGLE_MAPS_API_KEY not set — hunter disabled');
    }
  }

  static getInstance(): GoogleMapsClient {
    if (!GoogleMapsClient.instance) {
      GoogleMapsClient.instance = new GoogleMapsClient();
    }
    return GoogleMapsClient.instance;
  }

  /**
   * Search businesses by text query (e.g. "hotel bali", "klinik denpasar").
   */
  async searchPlaces(query: string, maxResults = 20): Promise<PlaceResult[]> {
    if (!this.apiKey) return [];

    const results: PlaceResult[] = [];
    let nextPageToken: string | undefined;

    while (results.length < maxResults) {
      const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
      url.searchParams.set('query', query);
      url.searchParams.set('key', this.apiKey);
      url.searchParams.set('language', 'id');
      if (nextPageToken) {
        url.searchParams.set('pagetoken', nextPageToken);
      }

      const response = await fetch(url.toString());
      const data: any = await response.json();

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.error(`[google-maps] Search error: ${data.status} — ${data.error_message || ''}`);
        break;
      }

      for (const place of data.results || []) {
        results.push({
          place_id: place.place_id,
          name: place.name,
          address: place.formatted_address || '',
          rating: place.rating,
          review_count: place.user_ratings_total,
          types: place.types || [],
          location: {
            lat: place.geometry?.location?.lat,
            lng: place.geometry?.location?.lng,
          },
        });
      }

      nextPageToken = data.next_page_token;
      if (!nextPageToken || results.length >= maxResults) break;

      // Google requires a short delay before using next_page_token
      await new Promise((r) => setTimeout(r, 2000));
    }

    return results.slice(0, maxResults);
  }

  /**
   * Get detailed info for a single place (phone, website, reviews).
   */
  async getPlaceDetails(placeId: string): Promise<{
    phone?: string;
    website?: string;
    reviews: PlaceReview[];
    business_hours?: string;
    url?: string;
  }> {
    if (!this.apiKey) return { reviews: [] };

    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.set('place_id', placeId);
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('fields', 'formatted_phone_number,website,reviews,opening_hours,url');
    url.searchParams.set('language', 'id');

    const response = await fetch(url.toString());
    const data: any = await response.json();

    if (data.status !== 'OK') {
      console.error(`[google-maps] Details error: ${data.status}`);
      return { reviews: [] };
    }

    const result = data.result || {};
    return {
      phone: result.formatted_phone_number,
      website: result.website,
      reviews: (result.reviews || []).map((r: any) => ({
        author: r.author_name,
        rating: r.rating,
        text: r.text,
        time: r.time,
        relative_time: r.relative_time_description,
      })),
      business_hours: result.opening_hours?.weekday_text?.join('; '),
      url: result.url,
    };
  }

  /**
   * Discover businesses and store as prospects in Supabase.
   */
  async discover(query: string, tenantId: string, batchSize = 20): Promise<number> {
    console.log(`[hunter] Discovering: "${query}" (max ${batchSize})`);

    const places = await this.searchPlaces(query, batchSize);
    let newCount = 0;

    const db = getSupabase();

    for (const place of places) {
      // Skip if already exists
      const { data: existing } = await db
        .from('mandala_hunter_prospects')
        .select('id')
        .eq('place_id', place.place_id)
        .single();

      if (existing) continue;

      // Get details (phone, website, reviews)
      const details = await this.getPlaceDetails(place.place_id);

      await db.from('mandala_hunter_prospects').insert({
        tenant_id: tenantId,
        place_id: place.place_id,
        business_name: place.name,
        address: place.address,
        phone: details.phone,
        website: details.website,
        rating: place.rating,
        review_count: place.review_count,
        reviews: details.reviews,
        types: place.types,
        location: place.location,
        business_hours: details.business_hours,
        maps_url: details.url,
        status: 'discovered',
        search_query: query,
      });

      newCount++;
      console.log(`[hunter] Discovered: ${place.name} (${details.phone || 'no phone'})`);

      // Small delay to respect rate limits
      await new Promise((r) => setTimeout(r, 500));
    }

    console.log(`[hunter] Discovery complete: ${newCount} new / ${places.length} total for "${query}"`);
    return newCount;
  }
}
