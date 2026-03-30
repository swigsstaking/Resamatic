import axios from 'axios';

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || '';
const PLACES_BASE = 'https://places.googleapis.com/v1';

/**
 * Resolve a Google Place ID from a Google Maps URL or business name+address.
 * Tries URL parsing first, then falls back to Text Search API.
 */
export async function resolvePlaceId(site) {
  const biz = site.business || {};

  // Already cached
  if (biz.googlePlaceId) return biz.googlePlaceId;

  // Try to extract from Google Maps URL patterns
  const url = biz.googleMapsUrl || '';
  const placeMatch = url.match(/place_id[=:]([A-Za-z0-9_-]+)/);
  if (placeMatch) return placeMatch[1];

  // Fallback: Text Search with business name + address
  const query = [biz.name, biz.address, biz.zip, biz.city].filter(Boolean).join(' ');
  if (!query.trim()) throw new Error('No business info available to resolve Place ID');

  const res = await axios.post(`${PLACES_BASE}/places:searchText`, {
    textQuery: query,
    maxResultCount: 1,
  }, {
    headers: {
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'places.id',
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  });

  const places = res.data.places;
  if (!places?.length) throw new Error(`No Google Place found for: ${query}`);

  return places[0].id;
}

/**
 * Fetch reviews for a given Place ID using Google Places API (New).
 * Returns up to 5 reviews with rating, total count, and Google Maps URL.
 */
export async function fetchReviews(placeId) {
  const res = await axios.get(`${PLACES_BASE}/places/${placeId}`, {
    params: { languageCode: 'fr' },
    headers: {
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'reviews,rating,userRatingCount,googleMapsUri',
    },
    timeout: 10000,
  });

  const data = res.data;
  const reviews = (data.reviews || [])
    .filter(r => (r.rating || 5) >= 4) // Only show positive reviews (4+ stars)
    .map(r => ({
      text: r.text?.text || '',
      name: r.authorAttribution?.displayName || 'Anonyme',
      rating: r.rating || 5,
      publishedAt: r.relativePublishTimeDescription || '',
      isGoogle: true,
    }));

  return {
    reviews,
    rating: data.rating || null,
    totalReviews: data.userRatingCount || 0,
    googleMapsUri: data.googleMapsUri || '',
  };
}

/**
 * Full flow: resolve Place ID + fetch reviews + return formatted data.
 */
export async function getGoogleReviews(site) {
  if (!API_KEY) throw new Error('GOOGLE_PLACES_API_KEY not configured');

  const placeId = await resolvePlaceId(site);
  const result = await fetchReviews(placeId);

  return { placeId, ...result };
}
