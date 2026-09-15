import type { GasStation, StationSnapshot } from '$lib/types';
import { haversineM, type LatLng } from '$lib/geo';

/**
 * Reactive, localStorage-backed favorites store.
 * Persists a compact snapshot of each favorite station so cards render even
 * when the station is outside the current radius or offline; snapshots are
 * refreshed whenever the station reappears in a fetch.
 */

const STORAGE_KEY = 'favorites.v1';

function isSnapshot(value: unknown): value is StationSnapshot {
	if (typeof value !== 'object' || value === null) return false;
	const v = value as Record<string, unknown>;
	return (
		typeof v.id === 'string' &&
		typeof v.name === 'string' &&
		typeof v.lat === 'number' &&
		typeof v.lng === 'number' &&
		typeof v.prices === 'object' &&
		v.prices !== null
	);
}

function readStored(): StationSnapshot[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(isSnapshot);
	} catch {
		return [];
	}
}

function toSnapshot(station: GasStation, savedAt = Date.now()): StationSnapshot {
	return {
		id: station.id,
		name: station.name,
		brand: station.brand,
		address: station.address,
		municipality: station.municipality,
		lat: station.lat,
		lng: station.lng,
		prices: { ...station.prices },
		savedAt
	};
}

class FavoritesStore {
	/** Favorite snapshots, newest first. */
	items = $state<StationSnapshot[]>(readStored());

	has(id: string): boolean {
		return this.items.some((f) => f.id === id);
	}

	/** Adds or removes a station from the favorites. */
	toggle(station: GasStation): void {
		this.items = this.has(station.id)
			? this.items.filter((f) => f.id !== station.id)
			: [toSnapshot(station), ...this.items];
		this.#persist();
	}

	/** Refreshes snapshots for favorites that appear in a new fetch. */
	refresh(stations: GasStation[]): void {
		if (this.items.length === 0 || stations.length === 0) return;
		const byId = new Map(stations.map((s) => [s.id, s]));
		let changed = false;
		this.items = this.items.map((f) => {
			const fresh = byId.get(f.id);
			if (!fresh) return f;
			changed = true;
			return toSnapshot(fresh, Date.now());
		});
		if (changed) this.#persist();
	}

	/** Favorite snapshots as `GasStation`s, with distance from `center` when given. */
	asStations(center?: LatLng | null): GasStation[] {
		return this.items.map((f) => ({
			...f,
			distanceM: center ? Math.round(haversineM(center.lat, center.lng, f.lat, f.lng)) : 0,
			updatedAt: f.savedAt
		}));
	}

	#persist(): void {
		if (typeof localStorage === 'undefined') return;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
		} catch {
			// ignore
		}
	}
}

export const favorites = new FavoritesStore();