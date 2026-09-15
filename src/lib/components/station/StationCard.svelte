<script lang="ts">
	import type { GasStation, FuelType } from '$lib/types';
	import { FUEL_LABELS } from '$lib/types';
	import { formatPrice, formatDistance } from '$lib/format';
	import { favorites } from '$lib/state/favorites.svelte';
	import { Navigation, ExternalLink, Star, Sparkles } from '@lucide/svelte';

	interface Props {
		station: GasStation;
		selected?: boolean;
		/** Active fuel filters. When empty, all fuels are shown. */
		activeFuels?: FuelType[];
		/** Marks the cheapest station in the current list (price-sorted views). */
		best?: boolean;
		/** Fuel that drives the price sort, used to highlight the best price chip. */
		bestFuel?: FuelType;
		onclick?: () => void;
	}

	let { station, selected = false, activeFuels = [], best = false, bestFuel, onclick }: Props = $props();

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

	/** Full search text for the "Open in Maps" action: name + full address. */
	const mapsQuery = $derived(
		`${station.name}, ${station.address}${station.municipality ? `, ${station.municipality}` : ''}`
	);

	const isFavorite = $derived(favorites.has(station.id));

	/** Open the station on Google Maps by name and full address. */
	function openInMaps(e: MouseEvent) {
		e.stopPropagation();
		const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`;
		window.open(url, '_blank');
	}

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
	<!-- Row 1: two columns — text (name + location) and actions, side by side. -->
	<div class="card-top">
		<div class="card-text">
			<h3 class="station-name">{station.name}</h3>
			<p class="station-address">{station.address}</p>
			<div class="station-meta">
				{#if station.municipality}
					<span class="station-municipality">{station.municipality}</span>
				{/if}
				<span class="distance">
					<Navigation class="size-3" />
					{formatDistance(station.distanceM)}
				</span>
			</div>
		</div>
		<div class="card-actions">
			<button
				class="icon-btn"
				class:active={isFavorite}
				onclick={toggleFavorite}
				aria-label={isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
				title={isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
			>
				<Star class="size-4" fill={isFavorite ? 'currentColor' : 'none'} />
			</button>
			<button
				class="icon-btn"
				onclick={openInMaps}
				aria-label="Abrir en Maps"
				title="Abrir en Maps"
			>
				<ExternalLink class="size-4" />
			</button>
		</div>
	</div>

	<!-- Row 2: location block (street · municipality + distance). -->
	<div class="station-location">
		<p class="station-address">{station.address}</p>
		<div class="station-meta">
			{#if station.municipality}
				<span class="station-municipality">{station.municipality}</span>
			{/if}
			<span class="distance">
				<Navigation class="size-3" />
				{formatDistance(station.distanceM)}
			</span>
		</div>
	</div>

	{#if best}
		<span class="best-badge">
			<Sparkles class="size-3" />
			Más barata
		</span>
	{/if}

	<!-- Row 3: price board. -->
	<div class="price-row">
		{#each visibleFuels as fuel (fuel.type)}
			{#if station.prices[fuel.type] != null}
				<div class="price-chip">
					<span class="price-label">{fuel.label}</span>
					<span class="price-value" class:best-price={best && bestFuel === fuel.type}>
						{formatPrice(station.prices[fuel.type]!)}
					</span>
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

	/* ---- Row 1: two columns (text | actions) ---- */
	.card-top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		padding-bottom: 0.375rem;
		border-bottom: 1px solid var(--border);
	}

	.card-text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.1875rem;
	}

	.station-name {
		margin: 0;
		font-size: 1rem;
		font-weight: 700;
		line-height: 1.25;
		letter-spacing: -0.01em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.card-actions {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		flex-shrink: 0;
	}

	.icon-btn {
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		color: var(--muted-foreground);
		cursor: pointer;
		border-radius: var(--radius-sm);
		transition:
			color var(--duration-fast) var(--ease-standard),
			background var(--duration-fast) var(--ease-standard);
	}

	.icon-btn:hover {
		color: var(--foreground);
		background: var(--muted);
	}

	.icon-btn.active {
		color: var(--brand);
	}

	/* ---- Text column details (address · municipality + distance) ---- */
	.station-address {
		margin: 0;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--foreground);
		line-height: 1.3;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.station-meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.station-municipality {
		font-size: 0.6875rem;
		font-weight: 600;
		color: var(--muted-foreground);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.distance {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--muted-foreground);
		white-space: nowrap;
		flex-shrink: 0;
	}

	/* ---- Best-price badge ---- */
	.best-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		align-self: flex-start;
		background: var(--brand);
		color: var(--brand-foreground);
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.01em;
		padding: 0.25rem 0.625rem;
		border-radius: var(--radius-pill);
	}

	/* ---- Row 3: price board ---- */
	.price-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.price-chip {
		flex: 1;
		min-width: 0;
		background: var(--muted);
		border-radius: calc(var(--radius) * 0.8);
		padding: 0.5rem 0.625rem 0.625rem;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.price-label {
		font-size: 0.5625rem;
		color: var(--muted-foreground);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.price-value {
		font-family: var(--font-display);
		font-size: 1.375rem;
		font-weight: 700;
		line-height: 1.05;
		letter-spacing: 0;
		font-variant-numeric: tabular-nums;
		margin-top: 0.25rem;
	}

	.price-value.best-price {
		color: var(--price-lower);
	}
</style>