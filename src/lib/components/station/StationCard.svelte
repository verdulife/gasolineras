<script lang="ts">
	import type { GasStation, FuelType } from '$lib/types';
	import { FUEL_LABELS } from '$lib/types';
	import { formatPrice, formatDistance } from '$lib/format';
	import { MapPin, Navigation, ExternalLink } from '@lucide/svelte';

	interface Props {
		station: GasStation;
		selected?: boolean;
		/** Active fuel filters. When empty, all fuels are shown. */
		activeFuels?: FuelType[];
		onclick?: () => void;
	}

	let { station, selected = false, activeFuels = [], onclick }: Props = $props();

	const FUEL_PRICES: { type: FuelType; label: string }[] = [
		{ type: 'gasolina95', label: FUEL_LABELS.gasolina95 },
		{ type: 'gasolina98', label: FUEL_LABELS.gasolina98 },
		{ type: 'diesel', label: FUEL_LABELS.diesel },
		{ type: 'diesel_premium', label: FUEL_LABELS.diesel_premium }
	];

	/** Only the price chips relevant to the active filter (or all if none). */
	const visibleFuels = $derived.by(() => {
		if (activeFuels.length === 0) return FUEL_PRICES;
		return FUEL_PRICES.filter((f) => activeFuels.includes(f.type));
	});

	/** Combined "street · city" location line. */
	const place = $derived(
		station.municipality ? `${station.address} · ${station.municipality}` : station.address
	);

	/** Full search text for the "Open in Maps" action: name + full address. */
	const mapsQuery = $derived(
		`${station.name}, ${station.address}${station.municipality ? `, ${station.municipality}` : ''}`
	);

	/** Open the station on Google Maps by name and full address. */
	function openInMaps(e: MouseEvent) {
		e.stopPropagation();
		const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`;
		window.open(url, '_blank');
	}

	function handleKey(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onclick?.();
		}
	}
</script>

<div
	class="station-card"
	class:selected
	role="button"
	tabindex="0"
	onclick={onclick}
	onkeydown={handleKey}
>
	<div class="card-header">
		<div class="card-title-area">
			<div class="title-text">
				<h3 class="station-name">{station.name}</h3>
				<p class="station-address">
					<MapPin class="size-3 shrink-0" />
					<span>{place}</span>
				</p>
			</div>
		</div>
		<span class="distance">
			<Navigation class="size-3" />
			{formatDistance(station.distanceM)}
		</span>
	</div>

	<div class="price-row">
		{#each visibleFuels as fuel (fuel.type)}
			{#if station.prices[fuel.type] != null}
				<div class="price-chip">
					<span class="price-label">{fuel.label}</span>
					<span class="price-value">{formatPrice(station.prices[fuel.type]!)}</span>
				</div>
			{/if}
		{/each}
	</div>

	{#if selected}
		<div class="extra-row">
			<button class="maps-btn" onclick={openInMaps}>
				<ExternalLink class="size-3" />
				Abrir en Maps
			</button>
		</div>
	{/if}
</div>

<style>
	.station-card {
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 0.875rem;
		text-align: left;
		width: 100%;
		cursor: pointer;
		transition: all 0.15s ease;
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		font-family: inherit;
		color: inherit;
	}

	.station-card:hover {
		border-color: var(--muted-foreground);
	}

	.station-card.selected {
		border-color: var(--brand);
		box-shadow: 0 0 0 1px var(--brand);
	}

	.station-card:focus-visible {
		outline: 2px solid var(--brand);
		outline-offset: 2px;
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.75rem;
	}

	.card-title-area {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		min-width: 0;
		flex: 1;
	}

	.title-text {
		min-width: 0;
	}

	.station-name {
		font-size: 0.875rem;
		font-weight: 600;
		line-height: 1.2;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.station-address {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.6875rem;
		color: var(--muted-foreground);
		margin-top: 2px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.distance {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.6875rem;
		font-weight: 500;
		color: var(--muted-foreground);
		white-space: nowrap;
		flex-shrink: 0;
	}

	.price-row {
		display: flex;
		gap: 0.375rem;
		flex-wrap: wrap;
	}

	.price-chip {
		background: var(--muted);
		border-radius: 8px;
		padding: 0.375rem 0.625rem;
		display: flex;
		flex-direction: column;
		gap: 1px;
		flex: 1;
		min-width: 0;
	}

	.price-label {
		font-size: 0.5625rem;
		color: var(--muted-foreground);
		text-transform: uppercase;
		letter-spacing: 0.03em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.price-value {
		font-size: 0.8125rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.02em;
	}

	.extra-row {
		display: flex;
		justify-content: flex-end;
	}

	.maps-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.75rem;
		border-radius: 999px;
		background: var(--brand);
		color: var(--brand-foreground);
		border: none;
		font-size: 0.75rem;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.maps-btn:hover {
		filter: brightness(0.95);
	}
</style>