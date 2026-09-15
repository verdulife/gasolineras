<script lang="ts">
	import type { GasStation, FuelType } from '$lib/types';
	import { FUEL_LABELS } from '$lib/types';
	import { formatPrice, formatDistance } from '$lib/format';
	import { favorites } from '$lib/state/favorites.svelte';
	import { MapPin, Navigation, ExternalLink, Star } from '@lucide/svelte';

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

	const isFavorite = $derived(favorites.has(station.id));

	function toggleFavorite(e: MouseEvent) {
		e.stopPropagation();
		favorites.toggle(station);
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
			<h3 class="station-name">{station.name}</h3>
			<p class="station-address">
				<MapPin class="size-3 shrink-0" />
				<span>{place}</span>
			</p>
		</div>
		<div class="card-actions">
			<button
				class="fav-btn"
				class:active={isFavorite}
				onclick={toggleFavorite}
				aria-label={isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
				title={isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
			>
				<Star class="size-3.5" fill={isFavorite ? 'currentColor' : 'none'} />
			</button>
			<button
				class="maps-icon-btn"
				onclick={openInMaps}
				aria-label="Abrir en Maps"
				title="Abrir en Maps"
			>
				<ExternalLink class="size-3.5" />
			</button>
			<span class="distance">
				<Navigation class="size-3" />
				{formatDistance(station.distanceM)}
			</span>
		</div>
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
</div>

<style>
	.station-card {
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: var(--radius-card);
		padding: var(--space-card-padding);
		text-align: left;
		width: 100%;
		cursor: pointer;
		transition: all var(--duration-fast) var(--ease-standard);
		display: flex;
		flex-direction: column;
		gap: var(--space-card-gap);
		font-family: inherit;
		color: inherit;
	}

	.station-card:hover {
		border-color: var(--muted-foreground);
		box-shadow: var(--shadow-card);
	}

	.station-card.selected {
		border-color: var(--brand);
		box-shadow: 0 0 0 1px var(--brand);
	}

	.station-card:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 2px;
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.75rem;
	}

	.card-title-area {
		flex: 1;
		min-width: 0;
	}

	.station-name {
		font-size: 0.9375rem;
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

	.card-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.fav-btn {
		width: 2rem;
		height: 2rem;
		border-radius: var(--radius-pill);
		background: var(--muted);
		color: var(--foreground);
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all var(--duration-fast) var(--ease-standard);
		flex-shrink: 0;
	}

	.fav-btn:hover {
		filter: brightness(0.92);
	}

	.fav-btn.active {
		background: var(--brand);
		color: var(--brand-foreground);
	}

	.maps-icon-btn {
		width: 2rem;
		height: 2rem;
		border-radius: var(--radius-pill);
		background: var(--muted);
		color: var(--foreground);
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: filter var(--duration-fast) var(--ease-standard);
		flex-shrink: 0;
	}

	.maps-icon-btn:hover {
		filter: brightness(0.92);
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
		border-radius: calc(var(--radius) * 0.8);
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
</style>
