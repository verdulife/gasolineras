/** Formats a price in €/L with 3 decimals, e.g. 1.559 -> "1,559 €". */
export function formatPrice(value: number): string {
	return `${formatDecimal(value)} €`;
}

/** Formats a decimal with 3 decimals using comma as separator (es-ES). */
export function formatDecimal(value: number): string {
	return new Intl.NumberFormat('es-ES', {
		minimumFractionDigits: 3,
		maximumFractionDigits: 3
	}).format(value);
}

/** Formats a distance in meters to a human readable string. */
export function formatDistance(meters: number): string {
	if (meters < 1000) return `${Math.round(meters)} m`;
	return `${(meters / 1000).toLocaleString('es-ES', {
		maximumFractionDigits: 1
	})} km`;
}

/** Relative "updated at" label in Spanish. */
export function formatUpdatedAt(ts: number): string {
	const diff = Date.now() - ts;
	const min = Math.floor(diff / 60000);
	if (min < 2) return 'ahora mismo';
	if (min < 60) return `hace ${min} min`;
	const h = Math.floor(min / 60);
	if (h < 24) return `hace ${h} h`;
	const d = Math.floor(h / 24);
	return `hace ${d} d`;
}