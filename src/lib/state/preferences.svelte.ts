import type { FuelType, Preferences, SortMode } from '$lib/types';

/**
 * Reactive, localStorage-backed user preferences.
 * Loads saved values on the client; falls back to defaults on the server
 * (SSR) and when storage is unavailable or corrupted.
 */

const STORAGE_KEY = 'prefs.v1';
const LEGACY_FILTER_KEY = 'fuelFilter';

export const RADIUS_MIN_KM = 5;
export const RADIUS_MAX_KM = 100;
export const DEFAULT_RADIUS_KM = 30;

export const ALL_FUELS: FuelType[] = ['gasolina95', 'gasolina98', 'diesel', 'diesel_premium'];

const DEFAULT_PREFS: Preferences = {
	radiusKm: DEFAULT_RADIUS_KM,
	fuels: [],
	sort: 'price',
	favoritesFirst: false
};

function isFuel(value: unknown): value is FuelType {
	return typeof value === 'string' && (ALL_FUELS as string[]).includes(value);
}

function isRadius(value: unknown): value is number {
	return (
		typeof value === 'number' && value >= RADIUS_MIN_KM && value <= RADIUS_MAX_KM
	);
}

function readStored(): Preferences {
	if (typeof localStorage === 'undefined') return { ...DEFAULT_PREFS };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw) as Partial<Preferences>;
			return {
				radiusKm: isRadius(parsed.radiusKm) ? parsed.radiusKm : DEFAULT_PREFS.radiusKm,
				fuels: Array.isArray(parsed.fuels) ? parsed.fuels.filter(isFuel) : [],
				sort: parsed.sort === 'distance' ? 'distance' : 'price',
				favoritesFirst: parsed.favoritesFirst === true
			};
		}
		// One-time migration from the legacy fuel-only filter key.
		const legacy = localStorage.getItem(LEGACY_FILTER_KEY);
		if (legacy) {
			const parsed = JSON.parse(legacy);
			return {
				...DEFAULT_PREFS,
				fuels: Array.isArray(parsed) ? parsed.filter(isFuel) : []
			};
		}
	} catch {
		// Storage unavailable or corrupted — fall back to defaults.
	}
	return { ...DEFAULT_PREFS };
}

/** Reactive preferences; mutate fields through the exported setters. */
export const prefs = $state<Preferences>(readStored());

function persist(): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				radiusKm: prefs.radiusKm,
				fuels: prefs.fuels,
				sort: prefs.sort,
				favoritesFirst: prefs.favoritesFirst
			})
		);
	} catch {
		// ignore
	}
}

export function setRadiusKm(km: number): void {
	if (!isRadius(km)) return;
	prefs.radiusKm = km;
	persist();
}

export function setSort(sort: SortMode): void {
	prefs.sort = sort === 'distance' ? 'distance' : 'price';
	persist();
}

export function setFavoritesFirst(value: boolean): void {
	prefs.favoritesFirst = value;
	persist();
}

export function toggleFuel(fuel: FuelType): void {
	prefs.fuels = prefs.fuels.includes(fuel)
		? prefs.fuels.filter((f) => f !== fuel)
		: [...prefs.fuels, fuel];
	persist();
}

export function clearFuels(): void {
	prefs.fuels = [];
	persist();
}