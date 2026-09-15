/**
 * Geographic helpers shared by the list and map views.
 * Units: distances in meters, coordinates in WGS84 degrees.
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

/** Default center used when no user location is available (Barcelona, Plaça Catalunya). */
export const DEFAULT_CENTER: LatLng = { lat: 41.3874, lng: 2.1686 };

const EARTH_RADIUS_M = 6371000;
const METERS_PER_DEG_LAT = 111320;

/** Great-circle distance between two coordinates, in meters (haversine). */
export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
	const toRad = (d: number) => (d * Math.PI) / 180;
	const dLat = toRad(lat2 - lat1);
	const dLng = toRad(lng2 - lng1);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
	return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Bounding box enclosing a circular radius around `center`.
 * Used to pre-filter the server dataset; the exact circular filter is
 * applied afterwards (server-side via `withinM` or client-side).
 */
export function bboxFromRadius(center: LatLng, radiusM: number): Bounds {
	const dLat = radiusM / METERS_PER_DEG_LAT;
	const dLng = radiusM / (METERS_PER_DEG_LAT * Math.cos((center.lat * Math.PI) / 180));
	return {
		swLat: center.lat - dLat,
		swLng: center.lng - dLng,
		neLat: center.lat + dLat,
		neLng: center.lng + dLng
	};
}