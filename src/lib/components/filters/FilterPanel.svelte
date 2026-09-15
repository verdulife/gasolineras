<script lang="ts">
	import { FUEL_LABELS } from '$lib/types';
	import {
		prefs,
		RADIUS_MIN_KM,
		RADIUS_MAX_KM,
		ALL_FUELS,
		clearFuels,
		setRadiusKm,
		setSort,
		setFavoritesFirst,
		toggleFuel
	} from '$lib/state/preferences.svelte';

	interface Props {
		onclose?: () => void;
	}

	let { onclose }: Props = $props();

	/** Fill percentage of the range track, computed from the stored radius. */
	const rangeFillPercent = $derived(
		((prefs.radiusKm - RADIUS_MIN_KM) / (RADIUS_MAX_KM - RADIUS_MIN_KM)) * 100
	);

	function onBackdrop(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose?.();
	}
</script>

<div class="filter-overlay" role="presentation" onclick={onBackdrop}>
	<div class="filter-panel" role="dialog" aria-label="Filtros">
		<div class="filter-panel-header">
			<span class="filter-title">Filtros</span>
			<button class="filter-close" onclick={onclose} aria-label="Cerrar filtros">✕</button>
		</div>

		<section class="filter-section">
			<h3 class="filter-section-title">Combustible</h3>
			<div class="chip-row">
				<button
					class="chip"
					class:chip-active={prefs.fuels.length === 0}
					onclick={clearFuels}
				>
					Todas
				</button>
				{#each ALL_FUELS as fuel (fuel)}
					<button
						class="chip"
						class:chip-active={prefs.fuels.includes(fuel)}
						onclick={() => toggleFuel(fuel)}
					>
						{FUEL_LABELS[fuel]}
					</button>
				{/each}
			</div>
		</section>

		<section class="filter-section">
			<h3 class="filter-section-title">Radio</h3>
			<div class="range-row">
				<input
					class="range"
					type="range"
					min={RADIUS_MIN_KM}
					max={RADIUS_MAX_KM}
					step={1}
					value={prefs.radiusKm}
					oninput={(e) => setRadiusKm(Number((e.target as HTMLInputElement).value))}
					style={`--range-fill: ${rangeFillPercent}%`}
					aria-label="Radio de búsqueda en kilómetros"
				/>
				<span class="range-value">{prefs.radiusKm} km</span>
			</div>
			<p class="range-hint">De {RADIUS_MIN_KM} a {RADIUS_MAX_KM} km</p>
		</section>

		<section class="filter-section">
			<h3 class="filter-section-title">Orden</h3>
			<div class="chip-row">
				<button class="chip" class:chip-active={prefs.sort === 'price'} onclick={() => setSort('price')}>
					Más baratas
				</button>
				<button
					class="chip"
					class:chip-active={prefs.sort === 'distance'}
					onclick={() => setSort('distance')}
				>
					Más cercanas
				</button>
			</div>
		</section>

		<section class="filter-section">
			<h3 class="filter-section-title">Favoritas</h3>
			<button
				class="switch-row"
				role="switch"
				aria-checked={prefs.favoritesFirst}
				onclick={() => setFavoritesFirst(!prefs.favoritesFirst)}
			>
				<span class="switch-label">Favoritas primero</span>
				<span class="switch" class:switch-on={prefs.favoritesFirst}>
					<span class="switch-knob"></span>
				</span>
			</button>
		</section>
	</div>
</div>

<style>
	.filter-overlay {
		position: fixed;
		inset: 0;
		z-index: 2000;
		background: transparent;
	}

	.filter-panel {
		position: fixed;
		top: 0.75rem;
		left: 0.75rem;
		right: 0.75rem;
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-md);
		padding: var(--space-card-padding);
		display: flex;
		flex-direction: column;
		gap: var(--space-section);
	}

	.filter-panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.filter-title {
		font-size: 0.9375rem;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.filter-close {
		width: 1.75rem;
		height: 1.75rem;
		border-radius: var(--radius-pill);
		border: none;
		background: var(--muted);
		color: var(--foreground);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: filter var(--duration-fast) var(--ease-standard);
		flex-shrink: 0;
	}

	.filter-close:hover {
		filter: brightness(0.95);
	}

	.filter-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-stack);
	}

	.filter-section-title {
		font-size: 0.6875rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--muted-foreground);
		margin: 0;
	}

	.chip-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.range-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.range {
		-webkit-appearance: none;
		appearance: none;
		flex: 1;
		min-width: 0;
		height: 0.375rem;
		border-radius: var(--radius-pill);
		background: linear-gradient(
			to right,
			var(--brand) var(--range-fill),
			var(--muted) var(--range-fill)
		);
		cursor: pointer;
	}

	.range::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
		background: var(--card);
		border: 2px solid var(--brand);
		box-shadow: var(--shadow-sm);
		cursor: grab;
		transition: transform var(--duration-fast) var(--ease-standard);
	}

	.range::-webkit-slider-thumb:hover {
		transform: scale(1.12);
	}

	.range::-moz-range-thumb {
		width: 1.375rem;
		height: 1.375rem;
		border-radius: 50%;
		background: var(--card);
		border: 2px solid var(--brand);
		box-shadow: var(--shadow-sm);
		cursor: grab;
	}

	.range:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 4px;
	}

	.range-value {
		flex-shrink: 0;
		min-width: 3.5rem;
		text-align: center;
		font-size: 0.8125rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--foreground);
		background: var(--muted);
		border-radius: var(--radius-pill);
		padding: 0.25rem 0.625rem;
	}

	.range-hint {
		font-size: 0.6875rem;
		color: var(--muted-foreground);
		margin: -0.25rem 0 0;
	}

	.chip {
		padding: 0.5rem 0.875rem;
		border-radius: var(--radius-pill);
		background: var(--muted);
		color: var(--foreground);
		border: 1px solid transparent;
		font-size: 0.8125rem;
		font-weight: 500;
		font-family: inherit;
		cursor: pointer;
		transition: all var(--duration-fast) var(--ease-standard);
	}

	.chip:hover {
		filter: brightness(0.95);
	}

	.chip.chip-active {
		background: var(--brand);
		color: var(--brand-foreground);
		border-color: transparent;
		font-weight: 600;
	}

	.switch-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		width: 100%;
		background: transparent;
		border: none;
		padding: 0;
		cursor: pointer;
		font-family: inherit;
	}

	.switch-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--foreground);
	}

	.switch {
		position: relative;
		width: 2.5rem;
		height: 1.5rem;
		border-radius: var(--radius-pill);
		background: var(--muted);
		transition: background var(--duration-fast) var(--ease-standard);
		flex-shrink: 0;
	}

	.switch.switch-on {
		background: var(--brand);
	}

	.switch-knob {
		position: absolute;
		top: 0.25rem;
		left: 0.25rem;
		width: 1rem;
		height: 1rem;
		border-radius: 50%;
		background: var(--card);
		box-shadow: var(--shadow-sm);
		transition: transform var(--duration-base) var(--ease-standard);
	}

	.switch.switch-on .switch-knob {
		transform: translateX(1rem);
	}
</style>