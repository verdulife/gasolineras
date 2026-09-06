import type { GasStation, StationQuery } from './types';

/**
 * Client data provider.
 * Queries the server proxy (GET /api/stations) for the gas stations
 * inside a given bounding box. The server caches the full Spain dataset
 * and returns only the stations for the requested zone.
 */

export interface LatLng {
	lat: number;
	lng: number;
}

export interface Bounds {
	swLat: number;
	swLng: number;
	neLat: number;
	neLng: number;
}

// Default center: Barcelona (Plaça Catalunya)
const DEFAULT_LAT = 41.3874;
const DEFAULT_LNG = 2.1686;

/** Force the server proxy to refetch the full dataset. */
export async function clearCache(): Promise<void> {
	await fetch('/api/stations?refresh=1');
}

/**
 * Returns the best gas stations inside the given bounds, ordered by relevance
 * (cheap + close). `limit` caps how many are returned.
 */
export async function listStationsInBounds(
	bounds: Bounds,
	center?: LatLng,
	limit = 50,
	sort: 'relevance' | 'distance' = 'relevance'
): Promise<GasStation[]> {
	const c = center ?? { lat: DEFAULT_LAT, lng: DEFAULT_LNG };
	const qs = new URLSearchParams({
		swLat: String(bounds.swLat),
		swLng: String(bounds.swLng),
		neLat: String(bounds.neLat),
		neLng: String(bounds.neLng),
		lat: String(c.lat),
		lng: String(c.lng),
		limit: String(limit),
		sort
	});
	const res = await fetch(`/api/stations?${qs}`);
	if (!res.ok) throw new Error(`No se pudieron cargar las estaciones (${res.status})`);
	return (await res.json()) as GasStation[];
}

/**
 * Lists nearby stations within a radial range of the user.
 * Builds a small bounding box around the center and asks the server.
 * @returns sorted ascending by distance.
 */
export async function listStations(query: StationQuery): Promise<GasStation[]> {
	const lat = query.userLat ?? DEFAULT_LAT;
	const lng = query.userLng ?? DEFAULT_LNG;
	const radiusM = query.withinM ?? 5000;
	// Approx degrees per meter at these latitudes.
	const dLat = radiusM / 111320;
	const dLng = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
	const bounds: Bounds = {
		swLat: lat - dLat,
		swLng: lng - dLng,
		neLat: lat + dLat,
		neLng: lng + dLng
	};
	const inBounds = await listStationsInBounds(bounds, { lat, lng });
	return inBounds.filter((s) => s.distanceM <= radiusM);
}