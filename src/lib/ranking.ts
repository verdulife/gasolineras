/**
 * Shared price-ranking helpers for the price-sorted views.
 * Mirrors the server-side ordering so the list and the favorites view agree.
 */

/** Price band in €: stations within this difference are treated as "same price". */
export const PRICE_BAND_EUR = 0.05;
/** Distance band in meters: stations within this range are treated as "same zone". */
export const DISTANCE_BAND_M = 5000;

/** Price of a fuel on a station's price map; missing means +∞ (sorted last). */
function priceOf(prices: Partial<Record<string, number>>, fuel: string): number {
	const v = prices[fuel];
	return typeof v === 'number' ? v : Number.POSITIVE_INFINITY;
}

/**
 * Compares two stations for the price-sorted views.
 *
 * Rules (stations must both have the fuel):
 * 1. Same zone (distance difference ≤ 5 km): the cheapest wins.
 * 2. Different zones but almost the same price (≤ 0.05 €): the nearest wins.
 * 3. Otherwise: the cheapest wins.
 * Stations without the fuel always go last, ordered by distance among them.
 *
 * `P` is left open so both the server `Station` (string fuel keys) and the
 * client `GasStation` (FuelType keys) satisfy it.
 */
export function priceDistanceCompare<P>(
	left: { prices: P; distanceM: number },
	right: { prices: P; distanceM: number },
	fuel: string
): number {
	const pa = priceOf(left.prices as Partial<Record<string, number>>, fuel);
	const pb = priceOf(right.prices as Partial<Record<string, number>>, fuel);
	const aMissing = pa === Number.POSITIVE_INFINITY;
	const bMissing = pb === Number.POSITIVE_INFINITY;
	if (aMissing || bMissing) {
		if (aMissing && bMissing) return left.distanceM - right.distanceM;
		return aMissing ? 1 : -1;
	}

	const diff = pa - pb;
	// Rule 1: same zone — the cheapest wins.
	if (Math.abs(left.distanceM - right.distanceM) <= DISTANCE_BAND_M) return diff;
	// Rule 2: different zones but almost the same price — the nearest wins.
	if (Math.abs(diff) <= PRICE_BAND_EUR) return left.distanceM - right.distanceM;
	// Rule 3: otherwise the cheapest wins.
	return diff;
}