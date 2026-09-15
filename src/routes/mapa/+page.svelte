<script lang="ts">
	import { AppNav } from '$lib/components/ui/app-nav';
	import { Map } from '$lib/components/map';
	import { BottomSheet } from '$lib/components/ui/bottom-sheet';
	import { StationCard } from '$lib/components/station';
	import { listStationsInBounds } from '$lib/data';
	import { bboxFromRadius, haversineM, type Bounds } from '$lib/geo';
	import { prefs } from '$lib/state/preferences.svelte';
	import type { GasStation } from '$lib/types';
	import { Crosshair } from '@lucide/svelte';

	// ---------- Map state ----------
	let stations: GasStation[] = $state([]);
	let listCache: GasStation[] = $state([]);
	let ready = $state(false);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let selectedId = $state<string | null>(null);
	let sheetLevel = $state<'peek' | 'medium' | 'full'>('peek');
	let userPosition = $state<{ lat: number; lng: number } | null>(null);
	let locating = $state(false);
	let locateError = $state<string | null>(null);
	let mapCenter = $state<{ lat: number; lng: number } | null>(null);

	let lastBounds: Bounds | null = null;
	let fetchSeq = 0;
	let zoneTimer: ReturnType<typeof setTimeout> | undefined;

	// ---------- List (bottom sheet) ----------
	let listPageLimit = $state(50);
	const PAGE_SIZE = 50;
	const FETCH_LIMIT = 200;
	const MAP_LIMIT = 20;

	/** Sheet list: distance from the current map center (nearest first). */
	let visibleStations = $derived.by(() => {
		const center = mapCenter;
		if (!center) return listCache.slice(0, listPageLimit);
		const sorted = [...listCache].sort(
			(a, b) =>
				haversineM(center.lat, center.lng, a.lat, a.lng) -
				haversineM(center.lat, center.lng, b.lat, b.lng)
		);
		return sorted.slice(0, listPageLimit);
	});
	let hasMoreStations = $derived(listPageLimit < listCache.length);

	function onListScroll(e: Event) {
		const el = e.target as HTMLElement;
		if (el.scrollHeight - el.scrollTop - el.clientHeight < 200 && hasMoreStations) {
			listPageLimit += PAGE_SIZE;
		}
	}

	$effect(() => {
		const level = sheetLevel;
		if (level === 'peek') return;
		requestAnimationFrame(() => {
			const container = document.querySelector('.sheet-content');
			if (!container) return;
			container.addEventListener('scroll', onListScroll, { passive: true });
		});
		return () => {
			document.querySelector('.sheet-content')?.removeEventListener('scroll', onListScroll);
		};
	});

	// ---------- Data loading ----------
	function handleBoundsChange(bounds: Bounds) {
		mapCenter = {
			lat: (bounds.swLat + bounds.neLat) / 2,
			lng: (bounds.swLng + bounds.neLng) / 2
		};
		lastBounds = bounds;
		clearTimeout(zoneTimer);
		zoneTimer = setTimeout(() => void loadZone(bounds), 200);
	}

	async function loadZone(bounds: Bounds) {
		const seq = ++fetchSeq;
		loading = true;
		error = null;
		try {
			const center = mapCenter ?? undefined;
			const list = await listStationsInBounds(bounds, center, FETCH_LIMIT, 'distance');
			if (seq !== fetchSeq) return;
			stations = list.slice(0, MAP_LIMIT);
			const existing = new Set(listCache.map((s) => s.id));
			listCache = [...listCache, ...list.filter((s) => !existing.has(s.id))];
			ready = true;
		} catch (e) {
			if (seq !== fetchSeq) return;
			error = e instanceof Error ? e.message : 'No se pudieron cargar las estaciones.';
		} finally {
			if (seq === fetchSeq) loading = false;
		}
	}

	// ---------- Geolocation ----------
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
				const bounds = bboxFromRadius({ lat, lng }, 3000);
				lastBounds = bounds;
				void loadZone(bounds);
			},
			(err) => {
				locating = false;
				locateError =
					err.code === 1
						? 'Permiso de ubicación denegado'
						: err.code === 2
							? 'No se pudo obtener tu ubicación'
							: 'Tiempo de espera agotado al obtener ubicación';
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

<svelte:head>
	<title>Mapa · Gasolineras</title>
</svelte:head>

<main class="shell">
	<AppNav />

	<div class="map-wrap">
		<Map
			{stations}
			bind:selectedId
			bind:userLocation={userPosition}
			onselect={handleSelect}
			onboundschange={handleBoundsChange}
		/>

		{#if loading && ready}
			<div class="zone-loading">
				<div class="loading-spinner"></div>
			</div>
		{/if}

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

		{#if locateError || error}
			<div class="locate-error" role="alert">
				<span>{locateError ?? error}</span>
				<button
					class="locate-dismiss"
					onclick={() => {
						locateError = null;
						error = null;
					}}
					aria-label="Cerrar"
				>
					✕
				</button>
			</div>
		{/if}
	</div>

	{#if ready}
		{#snippet sheetHeader()}
			<div class="sheet-header">
				<span class="peek-dot"></span>
				<h2 class="sheet-title">{listCache.length} en zona</h2>
			</div>
		{/snippet}
		<BottomSheet bind:level={sheetLevel} onchange={handleSheetChange} peekHeight={64}>
			{#snippet peekContent()}
				{@render sheetHeader()}
			{/snippet}
			{@render sheetHeader()}
			<div class="sheet-list">
				{#each visibleStations as station (station.id)}
					<StationCard
						{station}
						selected={station.id === selectedId}
						activeFuels={prefs.fuels}
						onclick={() => handleSelect(station)}
					/>
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
	{:else if !loading}
		<div class="loading-overlay">
			<div class="loading-spinner"></div>
			<p class="loading-text">Cargando gasolineras…</p>
		</div>
	{/if}
</main>

<style>
	.shell {
		position: fixed;
		inset: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.map-wrap {
		flex: 1;
		position: relative;
		min-height: 0;
	}

	.zone-loading {
		position: absolute;
		top: 0.75rem;
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

	.floating-controls {
		position: absolute;
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
		transition: all var(--duration-fast) var(--ease-standard);
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

	.locate-error {
		position: absolute;
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
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.locate-dismiss {
		background: none;
		border: none;
		color: white;
		font-size: 0.75rem;
		cursor: pointer;
		opacity: 0.8;
		padding: 0;
		line-height: 1;
	}

	.sheet-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0 0.5rem;
	}

	.peek-dot {
		width: 0.625rem;
		height: 0.625rem;
		border-radius: 50%;
		background: var(--brand);
		flex-shrink: 0;
	}

	.sheet-title {
		font-size: 1rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		margin: 0;
	}

	.sheet-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-stack);
		padding-bottom: 1rem;
	}

	.scroll-sentinel {
		display: flex;
		justify-content: center;
		padding: 0.75rem 0;
	}

	.empty-hint {
		text-align: center;
		font-size: 0.8125rem;
		color: var(--muted-foreground);
		padding: 1.5rem 0;
		margin: 0;
	}

	.loading-overlay {
		position: absolute;
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
		to {
			transform: rotate(360deg);
		}
	}

	.loading-text {
		font-size: 0.875rem;
		color: var(--muted-foreground);
		margin: 0;
	}
</style>