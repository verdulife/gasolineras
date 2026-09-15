import type { FuelType, GasStation, SortMode, StationQuery } from './types';
import { bboxFromRadius, DEFAULT_CENTER, type Bounds, type LatLng } from './geo';

/** Re-exported for callers that imported these from this module. */
export type { Bounds, LatLng };

/**
 * Client data provider.
 * Queries the server proxy (GET /api/stations) for the gas stations
 * inside a given zone. The server caches the full Spain dataset
 * and returns only the stations for the requested zone.
 */

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
	const c = center ?? DEFAULT_CENTER;
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

export interface RadiusQuery {
	/** Center of the search area. */
	center: LatLng;
	/** Radius in kilometers. */
	radiusKm: number;
	/** Selected fuels; the first one drives the price sort. Empty → gasoline95. */
	fuels?: FuelType[];
	sort?: SortMode;
	limit?: number;
}

/**
 * Fetches stations inside a circular radius around `center`, ordered by
 * `sort`. The server receives the enclosing bounding box plus an exact
 * `withinM` circular filter and the fuel used for the price order.
 */
export async function listStationsInRadius(query: RadiusQuery): Promise<GasStation[]> {
	const radiusM = query.radiusKm * 1000;
	const bounds = bboxFromRadius(query.center, radiusM);
	const qs = new URLSearchParams({
		swLat: String(bounds.swLat),
		swLng: String(bounds.swLng),
		neLat: String(bounds.neLat),
		neLng: String(bounds.neLng),
		lat: String(query.center.lat),
		lng: String(query.center.lng),
		limit: String(query.limit ?? 800),
		sort: query.sort === 'distance' ? 'distance' : 'price',
		fuel: query.fuels?.[0] ?? 'gasolina95',
		withinM: String(radiusM)
	});
	const res = await fetch(`/api/stations?${qs}`);
	if (!res.ok) {
		throw new Error(`No se pudieron cargar las estaciones (${res.status})`);
	}
	return (await res.json()) as GasStation[];
}

/**
 * Lists nearby stations within a radial range of the user.
 * Builds a small bounding box around the center and asks the server.
 * @returns sorted ascending by distance.
 */
export async function listStations(query: StationQuery): Promise<GasStation[]> {
	const lat = query.userLat ?? DEFAULT_CENTER.lat;
	const lng = query.userLng ?? DEFAULT_CENTER.lng;
	const radiusM = query.withinM ?? 5000;
	const bounds = bboxFromRadius({ lat, lng }, radiusM);
	const inBounds = await listStationsInBounds(bounds, { lat, lng });
	return inBounds.filter((s) => s.distanceM <= radiusM);
}