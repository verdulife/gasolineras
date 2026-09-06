<script lang="ts">
	import { onMount } from 'svelte';
	import { listStationsInBounds, type Bounds } from '$lib/data';
	import { Map } from '$lib/components/map';
	import { BottomSheet } from '$lib/components/ui/bottom-sheet';
	import { StationCard } from '$lib/components/station';
	import type { GasStation, FuelType } from '$lib/types';
	import { FUEL_LABELS } from '$lib/types';
	import { Fuel, Crosshair, Filter } from '@lucide/svelte';

	const FUEL_OPTIONS: { value: FuelType; label: string }[] = [
		{ value: 'gasolina95', label: FUEL_LABELS.gasolina95 },
		{ value: 'gasolina98', label: FUEL_LABELS.gasolina98 },
		{ value: 'diesel', label: FUEL_LABELS.diesel },
		{ value: 'diesel_premium', label: FUEL_LABELS.diesel_premium }
	];

	// ---------- Map state ----------
	let stations: GasStation[] = $state([]);
	let ready = $state(false);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let selectedId: string | null = $state(null);
	let sheetLevel = $state<'peek' | 'medium' | 'full'>('peek');
	let userPosition = $state<{ lat: number; lng: number } | null>(null);
	let locating = $state(false);
	let locateError = $state<string | null>(null);

	let lastBounds: Bounds | null = null;
	let fetchSeq = 0;
	let zoneTimer: ReturnType<typeof setTimeout> | undefined;

	/** Center of the map viewport, used to reorder the list by proximity. */
	let mapCenter = $state<{ lat: number; lng: number } | null>(null);

	// ---------- Infinite scroll state ----------
	/** All stations fetched across map moves, used as the scroll data source. */
	let listCache: GasStation[] = $state([]);
	let listPageLimit = $state(50);
	const PAGE_SIZE = 50;
	/** Amount of stations we request per fetch to feed the scroll cache. */
	const FETCH_LIMIT = 200;
	/** Max stations rendered as markers on the map (kept at the original default). */
	const MAP_LIMIT = 20;

	// ---------- Fuel filter ----------
	const FILTER_STORAGE_KEY = 'fuelFilter';

	function loadSavedFilter(): Set<FuelType> {
		try {
			const raw = localStorage.getItem(FILTER_STORAGE_KEY);
			if (!raw) return new Set();
			const arr = JSON.parse(raw) as FuelType[];
			return new Set(arr.filter((f) => FUEL_OPTIONS.some((o) => o.value === f)));
		} catch {
			return new Set();
		}
	}

	let fuelFilter = $state<Set<FuelType>>(loadSavedFilter());
	let showFilter = $state(false);

	// Persist the fuel filter so it survives reloads.
	$effect(() => {
		try {
			localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify([...fuelFilter]));
		} catch {
			// storage unavailable — ignore.
		}
	});

	function toggleFuel(f: FuelType) {
		const next = new Set(fuelFilter);
		if (next.has(f)) {
			next.delete(f);
		} else {
			next.add(f);
		}
		fuelFilter = next;
		listPageLimit = PAGE_SIZE;
	}

	// ---------- Scroll ↔ map guard ----------
	// When the user scrolls the list, suppress map-bound-triggered fetches
	// so the list stays stable. Cleared after a short idle period.
	let listScrolling = false;
	let scrollIdleTimer: ReturnType<typeof setTimeout> | undefined;

	// Derived: visible stations for the list, applied after the fuel filter, always
	// sorted by distance from the current map center (nearest first).
	let filteredStations = $derived.by(() => {
		if (fuelFilter.size === 0) return listCache;
		return listCache.filter((s) => [...fuelFilter].some((f) => typeof s.prices[f] === 'number'));
	});
	let visibleStations = $derived.by(() => {
		const center = mapCenter;
		if (!center) return filteredStations.slice(0, listPageLimit);
		const sorted = [...filteredStations].sort(
			(a, b) =>
				haversineM(center.lat, center.lng, a.lat, a.lng) -
				haversineM(center.lat, center.lng, b.lat, b.lng)
		);
		return sorted.slice(0, listPageLimit);
	});
	let hasMoreStations = $derived(listPageLimit < listCache.length);

	// Stations grouped by city (preserves distance order within each group).
	let groupedStations = $derived.by(() => {
		const groups: Record<string, GasStation[]> = {};
		const order: string[] = [];
		for (const s of visibleStations) {
			const city = s.municipality || 'Otros';
			if (!(city in groups)) {
				groups[city] = [];
				order.push(city);
			}
			groups[city].push(s);
		}
		return order.map((city) => ({ city, stations: groups[city] }));
	});

	// ---------- Scroll detection ----------
	function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
		const R = 6371000;
		const toRad = (d: number) => (d * Math.PI) / 180;
		const dLat = toRad(lat2 - lat1);
		const dLng = toRad(lng2 - lng1);
		const a =
			Math.sin(dLat / 2) ** 2 +
			Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
		return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	}

	function onListScroll(e: Event) {
		const el = e.target as HTMLElement;
		// Load next page when within 200px of the bottom.
		if (el.scrollHeight - el.scrollTop - el.clientHeight < 200 && hasMoreStations) {
			listPageLimit += PAGE_SIZE;
		}
		// Guard: prevent map from re-fetching while user is browsing the list.
		listScrolling = true;
		clearTimeout(scrollIdleTimer);
		scrollIdleTimer = setTimeout(() => {
			listScrolling = false;
		}, 600);
	}

	// Attach / detach scroll listener when sheet opens or closes.
	$effect(() => {
		const level = sheetLevel;
		if (level === 'peek') return; // no scroll container visible

		// Wait one frame for the DOM to render the sheet content.
		requestAnimationFrame(() => {
			const container = document.querySelector('.sheet-content');
			if (!container) return;
			container.addEventListener('scroll', onListScroll, { passive: true });
		});

		return () => {
			document.querySelector('.sheet-content')?.removeEventListener('scroll', onListScroll);
		};
	});

	// ---------- Map callbacks ----------
	onMount(() => {
		const perm = navigator.permissions?.query;
		if (perm) {
			perm({ name: 'geolocation' })
				.then((s) => {
					if (s.state === 'granted') locateUser();
				})
				.catch(() => {});
		}
	});

	function handleBoundsChange(bounds: Bounds) {
		// Always reflect the current map center so the list reorders by proximity.
		mapCenter = {
			lat: (bounds.swLat + bounds.neLat) / 2,
			lng: (bounds.swLng + bounds.neLng) / 2
		};

		// If the user is actively scrolling the list, skip re-fetching stations to
		// keep the list stable (the center is still tracked).
		if (listScrolling) return;

		lastBounds = bounds;
		clearTimeout(zoneTimer);
		zoneTimer = setTimeout(() => void loadZone(bounds), 200);
	}

	async function loadZone(bounds: Bounds) {
		const seq = ++fetchSeq;
		loading = true;
		error = null;
		try {
			// Fetch more stations to populate the infinite scroll cache, but keep
			// the map markers limited to MAP_LIMIT as before.
			const list = await listStationsInBounds(bounds, userPosition ?? undefined, FETCH_LIMIT);
			if (seq !== fetchSeq) return;

			stations = list.slice(0, MAP_LIMIT);

			// Merge into the list cache (deduplicate by id).
			const existingIds = new Set(listCache.map((s) => s.id));
			const newStations = list.filter((s) => !existingIds.has(s.id));
			listCache = [...listCache, ...newStations];

			ready = true;
		} catch (e) {
			if (seq !== fetchSeq) return;
			error = e instanceof Error ? e.message : 'No se pudieron cargar las estaciones.';
		} finally {
			if (seq === fetchSeq) loading = false;
		}
	}

	function locateUser() {
		if (!('geolocation' in navigator)) {
			locateError = 'Tu navegador no soporta geolocalización';
			return;
		}
		locating = true;
		locateError = null;
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				const lat = pos.coords.latitude;
				const lng = pos.coords.longitude;
				userPosition = { lat, lng };
				locating = false;
				const dLat = 3 / 111.32;
				const dLng = 3 / (111.32 * Math.cos((lat * Math.PI) / 180));
				const b: Bounds = {
					swLat: lat - dLat,
					swLng: lng - dLng,
					neLat: lat + dLat,
					neLng: lng + dLng
				};
				lastBounds = b;
				void loadZone(b);
			},
			(err) => {
				locating = false;
				locateError = err.message;
			},
			{ enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
		);
	}

	function handleSelect(station: GasStation) {
		selectedId = station.id;
		sheetLevel = 'medium';
	}

	function handleSheetChange(_level: 'peek' | 'medium' | 'full') {
		// Reserved.
	}
</script>

<div class="page">
	<!-- Map fills the entire viewport (stays mounted) -->
	<Map
		{stations}
		bind:selectedId
		bind:userLocation={userPosition}
		onselect={handleSelect}
		onboundschange={handleBoundsChange}
	/>

	<!-- Zone loading indicator (does not unmount the map) -->
	{#if loading && ready}
		<div class="zone-loading">
			<div class="loading-spinner"></div>
		</div>
	{/if}

	<!-- Floating controls -->
	<div class="floating-controls">
		<button
			class="control-btn"
			class:located={!!userPosition}
			onclick={locateUser}
			disabled={locating}
			aria-label="Usar mi ubicación"
			title="Usar mi ubicación"
		>
			<Crosshair class={locating ? 'size-4 animate-spin' : 'size-4'} />
		</button>
	</div>
	{#if locateError}
		<div class="locate-error">{locateError}</div>
	{/if}

	<!-- Floating fuel filter panel -->
	{#if showFilter}
		<div
			class="filter-overlay"
			role="presentation"
			onclick={(e) => { if (e.target === e.currentTarget) showFilter = false; }}
			onkeydown={(e) => { if (e.key === 'Escape') showFilter = false; }}
		>
			<div class="filter-panel">
				<div class="filter-panel-header">
					<span class="filter-title">Filtrar por combustible</span>
					<button class="filter-close" onclick={() => (showFilter = false)} aria-label="Cerrar filtro">✕</button>
				</div>
				<div class="filter-options">
					<button
						class="filter-option"
						class:checked={fuelFilter.size === 0}
						onclick={() => { fuelFilter = new Set(); listPageLimit = PAGE_SIZE; }}
					>Todas</button
					>
					{#each FUEL_OPTIONS as f (f.value)}
						<button
							class="filter-option"
							class:checked={fuelFilter.has(f.value)}
							onclick={() => toggleFuel(f.value)}
						>{f.label}</button
						>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<!-- Bottom sheet with station list -->
	{#if !ready}
		{#if error}
			<div class="error-overlay">
				<div class="error-content">
					<Fuel class="size-8 text-muted-foreground" />
					<p class="error-text">{error}</p>
					<button class="retry-btn" onclick={() => lastBounds && void loadZone(lastBounds)}>Reintentar</button>
				</div>
			</div>
		{:else}
			<div class="loading-overlay">
				<div class="loading-spinner"></div>
				<p class="loading-text">Cargando gasolineras…</p>
			</div>
		{/if}
	{:else}
		{#snippet stationListHeader()}
			<div class="list-header">
				<div class="header-left">
					<span class="peek-dot"></span>
					<h2 class="list-title">{filteredStations.length} en zona</h2>
				</div>
				<button
					class="filter-btn"
					class:active={showFilter || fuelFilter.size > 0}
					onclick={() => (showFilter = !showFilter)}
					aria-label="Filtrar por combustible"
					title="Filtrar por combustible"
				>
					<Filter class="size-3" />
				</button>
			</div>
		{/snippet}
		<BottomSheet
			bind:level={sheetLevel}
			onchange={handleSheetChange}
			peekHeight={96}
		>
			{#snippet peekContent()}
				{@render stationListHeader()}
			{/snippet}
			<div class="station-list">
				{@render stationListHeader()}
				{#each groupedStations as group (group.city)}
					<div class="city-group">
						<h3 class="city-title">{group.city}</h3>
						{#each group.stations as station (station.id)}
							<StationCard
								{station}
								selected={station.id === selectedId}
								activeFuels={[...fuelFilter]}
								onclick={() => handleSelect(station)}
							/>
						{/each}
					</div>
				{/each}
				{#if hasMoreStations}
					<div class="scroll-sentinel">
						<div class="loading-spinner small"></div>
					</div>
				{/if}
				{#if visibleStations.length === 0}
					<p class="empty-hint">Sin estaciones en esta zona</p>
				{/if}
			</div>
		</BottomSheet>
		{#if error}
			<div class="locate-error">{error}</div>
		{/if}
	{/if}
</div>

<style>
	.page {
		position: fixed;
		inset: 0;
		overflow: hidden;
	}

	/* Floating controls */
	.floating-controls {
		position: fixed;
		top: 0.75rem;
		right: 0.75rem;
		z-index: 900;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.control-btn {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 50%;
		background: var(--card);
		color: var(--foreground);
		border: 1px solid var(--border);
		box-shadow: var(--shadow-md);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.control-btn.located {
		background: var(--brand);
		color: var(--brand-foreground);
		border-color: transparent;
	}

	.control-btn:hover {
		filter: brightness(0.95);
	}

	.control-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.locate-error {
		position: fixed;
		top: 4rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 1100;
		background: var(--destructive);
		color: white;
		font-size: 0.75rem;
		font-weight: 500;
		padding: 0.4rem 0.8rem;
		border-radius: 999px;
		box-shadow: var(--shadow-md);
		max-width: 90%;
		text-align: center;
	}
	/* Station list inside sheet */
	.station-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding-bottom: 1rem;
	}

	.list-header {
		position: sticky;
		top: 0;
		z-index: 2;
		background: var(--card);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.25rem 0 0.5rem;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.filter-btn {
		width: 2rem;
		height: 2rem;
		border-radius: 999px;
		border: 1px solid var(--border);
		background: var(--card);
		color: var(--foreground);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.15s ease;
		flex-shrink: 0;
	}

	.filter-btn.active {
		background: var(--brand);
		color: var(--brand-foreground);
		border-color: transparent;
	}

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
		border-radius: 12px;
		box-shadow: var(--shadow-md);
		padding: 0.875rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.filter-panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.filter-title {
		font-size: 0.875rem;
		font-weight: 700;
	}

	.filter-close {
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 999px;
		border: none;
		background: var(--muted);
		color: var(--foreground);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.filter-close:hover {
		filter: brightness(0.95);
	}

	.filter-options {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.filter-option {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		width: 100%;
		padding: 0.625rem 0.75rem;
		border-radius: 8px;
		border: none;
		background: transparent;
		color: var(--foreground);
		font-size: 0.875rem;
		font-weight: 500;
		font-family: inherit;
		cursor: pointer;
		text-align: left;
		transition: all 0.15s ease;
	}

	.filter-option:hover {
		background: var(--muted);
	}

	.filter-option.checked {
		background: var(--muted);
		font-weight: 700;
	}

	.filter-option.checked::after {
		content: '✓';
		color: var(--brand);
		font-weight: 700;
	}

	.list-title {
		font-size: 1rem;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.city-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.city-group + .city-group {
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border);
	}

	.city-title {
		position: sticky;
		top: 44px;
		z-index: 1;
		padding-top: 0.5rem;
		padding-bottom: 0.375rem;
		background: var(--card);
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--muted-foreground);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.peek-dot {
		width: 0.625rem;
		height: 0.625rem;
		border-radius: 50%;
		background: var(--brand);
		flex-shrink: 0;
	}

	.empty-hint {
		text-align: center;
		font-size: 0.8125rem;
		color: var(--muted-foreground);
		padding: 1.5rem 0;
	}

	.scroll-sentinel {
		display: flex;
		justify-content: center;
		padding: 0.75rem 0;
	}

	.scroll-sentinel .loading-spinner {
		width: 1.25rem;
		height: 1.25rem;
	}

	/* Loading */
	.loading-overlay {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 1000;
		background: var(--card);
		border-radius: 1rem 1rem 0 0;
		box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.12);
		padding: 2rem 1.5rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		height: 200px;
	}

	.zone-loading {
		position: fixed;
		top: 1rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 900;
		background: var(--card);
		border: 1px solid var(--border);
		box-shadow: var(--shadow-md);
		padding: 0.4rem;
		border-radius: 999px;
		display: flex;
		align-items: center;
		pointer-events: none;
	}

	.zone-loading .loading-spinner {
		width: 1.1rem;
		height: 1.1rem;
	}

	.loading-spinner {
		width: 1.5rem;
		height: 1.5rem;
		border: 2px solid var(--border);
		border-top-color: var(--brand);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}


	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.loading-text {
		font-size: 0.875rem;
		color: var(--muted-foreground);
	}

	/* Error */
	.error-overlay {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 1000;
		background: var(--card);
		border-radius: 1rem 1rem 0 0;
		box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.12);
		padding: 2rem 1.5rem;
	}

	.error-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
	}

	.error-text {
		font-size: 0.875rem;
		color: var(--destructive);
		text-align: center;
	}

	.retry-btn {
		padding: 0.5rem 1.25rem;
		border-radius: var(--radius-control);
		background: var(--foreground);
		color: var(--background);
		font-size: 0.875rem;
		font-weight: 600;
		border: none;
		cursor: pointer;
	}
</style>
