import type { RequestHandler } from './$types';
import grid from '$lib/province-grid.json';

/**
 * Server-side proxy for the Spanish government fuel-price API.
 *
 * Resolves gas-station zones "on the fly" WITHOUT downloading the whole
 * country dataset. The free API cannot answer a radius/bbox query
 * (only "whole Spain" or "per province"), so:
 *  1. A small offline grid (province-grid.json) maps each ~0.2° cell to
 *     the province(s) covering it.
 *  2. For a requested bounding box, we compute the covered cells, collect
 *     the needed province IDs, and fetch ONLY those provinces from the
 *     API (each lazily cached in process memory).
 *  3. Stations are then filtered to the exact bbox.
 *
 * Memory stays small: only the provinces the user visits are cached, and
 * only as compact objects (not the raw 60MB payloads).
 */

// Province filter endpoint: returns a single province's stations.
function provinceUrl(provinceId: string): string {
	return `https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/FiltroProvincia/${provinceId}`;
}

// Cap on stations returned per request to keep responses reasonable.
const MAX_STATIONS = 800;
// Default page size returned to the client.
const DEFAULT_LIMIT = 50;
// Reference fuel used to rank "best" stations (cheap + close) and to
// order by price when the client asks for `sort=price`.
const RANK_FUEL = 'gasolina95';
const FUEL_TYPES = ['gasolina95', 'gasolina98', 'diesel', 'diesel_premium'] as const;
// Relevance weights.
const W_PRICE = 0.6;
const W_DIST = 0.4;

interface Station {
	id: string;
	name: string;
	brand: string;
	address: string;
	municipality: string;
	lat: number;
	lng: number;
	updatedAt: number;
	distanceM: number;
	prices: Partial<Record<string, number>>;
}

interface RawStation {
	IDEESS: string;
	Rótulo: string;
	Dirección: string;
	Municipio: string;
	Latitud: string;
	'Longitud (WGS84)': string;
	'Precio Gasolina 95 E5': string;
	'Precio Gasolina 98 E10': string;
	'Precio Gasoleo A': string;
	'Precio Gasoleo Premium': string;
}

function parseDecimal(str: string): number | undefined {
	if (!str) return undefined;
	return parseFloat(str.replace(',', '.'));
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
	const R = 6371000;
	const toRad = (d: number) => (d * Math.PI) / 180;
	const dLat = toRad(lat2 - lat1);
	const dLng = toRad(lng2 - lng1);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function mapCompact(raw: RawStation): Station | null {
	const lat = parseDecimal(raw.Latitud);
	const lng = parseDecimal(raw['Longitud (WGS84)']);
	if (lat == null || lng == null) return null;
	return {
		id: raw.IDEESS,
		name: raw.Rótulo,
		brand: raw.Rótulo,
		address: raw.Dirección,
		municipality: raw.Municipio,
		lat,
		lng,
		updatedAt: Date.now(),
		distanceM: 0,
		prices: {
			gasolina95: parseDecimal(raw['Precio Gasolina 95 E5']),
			gasolina98: parseDecimal(raw['Precio Gasolina 98 E10']),
			diesel: parseDecimal(raw['Precio Gasoleo A']),
			diesel_premium: parseDecimal(raw['Precio Gasoleo Premium'])
		}
	};
}

// provinceId -> compact stations, lazily populated per province.
const provinceCache = new Map<string, Station[]>();

/** True if the station has at least one reported price. */
function hasAnyPrice(s: Station): boolean {
	return Object.values(s.prices).some((p) => typeof p === 'number');
}

async function getProvince(provinceId: string): Promise<Station[]> {
	const cached = provinceCache.get(provinceId);
	if (cached) return cached;

	const res = await fetch(provinceUrl(provinceId));
	if (!res.ok) throw new Error(`API error for province ${provinceId}: ${res.status}`);
	const data = await res.json();
	const raw: RawStation[] = data.ListaEESSPrecio ?? [];

	const stations = raw
		.map((s) => mapCompact(s))
		.filter((s): s is Station => s !== null && hasAnyPrice(s));

	provinceCache.set(provinceId, stations);
	return stations;
}

// Grid parameters — must match how province-grid.json was built.
const GRID_LAT = 27.0;
const GRID_LNG = -19.0;
const GRID_CELL = 0.2;

/** Provinces covering the given bounding box, via the offline grid. */
function provincesForBounds(
	swLat: number,
	swLng: number,
	neLat: number,
	neLng: number
): string[] {
	const ix0 = Math.floor((swLng - GRID_LNG) / GRID_CELL);
	const ix1 = Math.floor((neLng - GRID_LNG) / GRID_CELL);
	const iy0 = Math.floor((swLat - GRID_LAT) / GRID_CELL);
	const iy1 = Math.floor((neLat - GRID_LAT) / GRID_CELL);

	const ids = new Set<string>();
	for (let ix = ix0; ix <= ix1; ix++) {
		for (let iy = iy0; iy <= iy1; iy++) {
			const cell = grid[`${ix}:${iy}` as keyof typeof grid];
			if (cell) cell.forEach((id) => ids.add(id));
		}
	}
	return [...ids];
}

export const GET: RequestHandler = async ({ url }) => {
	// Optional hard refresh: invalidate per-province cache and refetch.
	if (url.searchParams.get('refresh') === '1') {
		provinceCache.clear();
	}

	const swLat = parseFloat(url.searchParams.get('swLat') ?? '');
	const swLng = parseFloat(url.searchParams.get('swLng') ?? '');
	const neLat = parseFloat(url.searchParams.get('neLat') ?? '');
	const neLng = parseFloat(url.searchParams.get('neLng') ?? '');
	const centerLat = parseFloat(url.searchParams.get('lat') ?? '');
	const centerLng = parseFloat(url.searchParams.get('lng') ?? '');
	const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);
	const safeSortParam = url.searchParams.get('sort') ?? 'relevance';
	const sort = safeSortParam === 'distance' || safeSortParam === 'price' ? safeSortParam : 'relevance';
	const requestedFuel = url.searchParams.get('fuel') ?? '';
	const rankFuel = (FUEL_TYPES as readonly string[]).includes(requestedFuel)
		? requestedFuel
		: RANK_FUEL;
	const withinMRaw = parseFloat(url.searchParams.get('withinM') ?? '');
	const withinM = Number.isFinite(withinMRaw) && withinMRaw > 0 ? withinMRaw : null;

	if ([swLat, swLng, neLat, neLng].some((n) => Number.isNaN(n))) {
		return new Response(JSON.stringify({ error: 'Invalid bounds' }), { status: 400 });
	}

	// Provinces intersecting the requested area.
	const provinceIds = provincesForBounds(swLat, swLng, neLat, neLng);

	// Fetch each needed province in parallel, then filter to the exact bbox.
	const provinceLists = await Promise.all(provinceIds.map((id) => getProvince(id)));
	const inBounds = provinceLists
		.flat()
		.filter((s) => s.lat >= swLat && s.lat <= neLat && s.lng >= swLng && s.lng <= neLng);

	const hasCenter = !Number.isNaN(centerLat) && !Number.isNaN(centerLng);
	const safeLimit = Math.max(1, Math.min(limit, MAX_STATIONS));

	// Work on shallow copies so we never mutate the shared per-province cache
	// (distances and scores are per-request / per-user).
	const candidates = inBounds.map((s) => ({
		...s,
		distanceM: hasCenter ? Math.round(haversine(centerLat, centerLng, s.lat, s.lng)) : 0
	}));

	// Optional exact circular radius filter (the enclosing box was already applied).
	const pool = hasCenter && withinM ? candidates.filter((s) => s.distanceM <= withinM) : candidates;

	let ordered = pool;
	if (hasCenter) {
		if (sort === 'distance') {
			// Pure distance ordering — used by the favorites / proximity sort.
			ordered = [...pool].sort((a, b) => a.distanceM - b.distanceM);
		} else if (sort === 'price') {
			// Ascending price for the requested fuel; stations without that fuel
			// go last, ties broken by distance.
			const priceOf = (s: Station): number => {
				const p = s.prices[rankFuel];
				return typeof p === 'number' ? p : Number.POSITIVE_INFINITY;
			};
			ordered = [...pool].sort((a, b) => priceOf(a) - priceOf(b) || a.distanceM - b.distanceM);
		} else {
			// Default: order by relevance (cheap AND close).
			const withFuel = pool.filter((s) => typeof s.prices[rankFuel] === 'number');
			const minPrice =
				withFuel.length > 0 ? Math.min(...withFuel.map((s) => s.prices[rankFuel] as number)) : 0;
			const maxPrice =
				withFuel.length > 0 ? Math.max(...withFuel.map((s) => s.prices[rankFuel] as number)) : 0;
			const minDist = pool.length > 0 ? Math.min(...pool.map((s) => s.distanceM)) : 0;
			const maxDist = pool.length > 0 ? Math.max(...pool.map((s) => s.distanceM)) : 1;
			const priceSpan = maxPrice - minPrice || 1;
			const distSpan = maxDist - minDist || 1;

			const scored = pool.map((s) => {
				const p = s.prices[rankFuel];
				const priceNorm = typeof p === 'number' ? (p - minPrice) / priceSpan : 1;
				const distNorm = (s.distanceM - minDist) / distSpan;
				return { s, score: W_PRICE * priceNorm + W_DIST * distNorm };
			});
			scored.sort((a, b) => a.score - b.score);
			ordered = scored.map((x) => x.s);
		}
	}

	const limited = ordered.slice(0, safeLimit);

	return new Response(JSON.stringify(limited), {
		headers: { 'content-type': 'application/json; charset=utf-8' }
	});
};