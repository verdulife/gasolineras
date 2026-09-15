/**
 * Core domain types for the fuel-price PWA.
 * NOTE: provisional — models the future API source. Units:
 * - price: EUR per liter (€/L)
 * - distance: meters
 */

export type FuelType =
	| 'gasolina95'
	| 'gasolina98'
	| 'diesel'
	| 'diesel_premium';

export type FuelPrices = Partial<Record<FuelType, number>>;

export interface GasStation {
	id: string;
	name: string;
	brand: string;
	address: string;
	municipality: string;
	lat: number;
	lng: number;
	/** Distance from the user in meters. */
	distanceM: number;
	/** Last update timestamp (epoch ms). */
	updatedAt: number;
	prices: FuelPrices;
}

export interface StationQuery {
	/** Radial distance to search within, in meters. */
	withinM: number;
	userLat?: number;
	userLng?: number;
}

export type PriceTrend = 'lower' | 'higher' | 'neutral';

/** Resolves the semantic trend token for a fuel at a station. */
export function priceTrend(
	station: GasStation,
	fuel: FuelType,
	baseline: number
): PriceTrend {
	const price = station.prices[fuel];
	if (price == null) return 'neutral';
	if (price < baseline) return 'lower';
	if (price > baseline) return 'higher';
	return 'neutral';
}

export const FUEL_LABELS: Record<FuelType, string> = {
	gasolina95: 'Gasolina 95',
	gasolina98: 'Gasolina 98',
	diesel: 'Diésel',
	diesel_premium: 'Diésel Premium'
};

export type SortMode = 'price' | 'distance';

export interface Preferences {
	/** Search radius in kilometers. */
	radiusKm: number;
	/** Selected fuels; empty means "all". */
	fuels: FuelType[];
	/** Sort order applied to the station list. */
	sort: SortMode;
	/** When true, the list shows only favorite stations. */
	favoritesFirst: boolean;
}

/**
 * Persisted snapshot of a favorite station. Keeps the card renderable
 * even when the station is outside the current radius or offline.
 */
export interface StationSnapshot {
	id: string;
	name: string;
	brand: string;
	address: string;
	municipality: string;
	lat: number;
	lng: number;
	prices: FuelPrices;
	/** Epoch ms of the last time this snapshot was refreshed. */
	savedAt: number;
}
