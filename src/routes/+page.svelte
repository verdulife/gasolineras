<script lang="ts">
	import { onMount } from 'svelte';
	import { listStationsInRadius } from '$lib/data';
	import { StationCard } from '$lib/components/station';
	import { prefs } from '$lib/state/preferences.svelte';
	import { favorites } from '$lib/state/favorites.svelte';
	import type { FuelType, GasStation } from '$lib/types';
	import { Crosshair } from '@lucide/svelte';

	// ---------- State ----------
	let stations: GasStation[] = $state([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let userPosition = $state<{ lat: number; lng: number } | null>(null);
	let locating = $state(false);
	let locateError = $state<string | null>(null);

	let fetchSeq = 0;

	/** Sort fuel used for price comparisons. */
	const priceFuel = $derived<FuelType>(prefs.fuels[0] ?? 'gasolina95');

	/** Price–ascending comparator; missing fuel goes last, ties broken by distance. */
	function priceCompare(a: GasStation, b: GasStation): number {
		const pa =
			priceFuel in a.prices && typeof a.prices[priceFuel] === 'number'
				? a.prices[priceFuel]!
				: Number.POSITIVE_INFINITY;
		const pb =
			priceFuel in b.prices && typeof b.prices[priceFuel] === 'number'
				? b.prices[priceFuel]!
				: Number.POSITIVE_INFINITY;
		return pa - pb || a.distanceM - b.distanceM;
	}

	/** Favorites as render-ready stations, sorted by the active mode. */
	let favoriteStations = $derived.by(() => {
		const list = favorites.asStations(userPosition);
		if (prefs.sort === 'distance') return [...list].sort((a, b) => a.distanceM - b.distanceM);
		return [...list].sort(priceCompare);
	});

	// Derived: show only stations that have at least one active fuel price, or
	// the favorites list when the favorites-only mode is on.
	let visibleStations = $derived.by(() => {
		if (prefs.favoritesOnly) return favoriteStations;
		return stations.filter(
			(s) => prefs.fuels.length === 0 || prefs.fuels.some((f) => typeof s.prices[f] === 'number')
		);
	});

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
				userPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
				locating = false;
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

	// ---------- Data loading ----------
	async function loadStations() {
		if (!userPosition) return;
		const mySeq = ++fetchSeq;
		loading = true;
		error = null;
		try {
			const result = await listStationsInRadius({
				center: userPosition,
				radiusKm: prefs.radiusKm,
				fuels: prefs.fuels,
				sort: prefs.sort
			});
			if (mySeq !== fetchSeq) return;
			stations = result;
			favorites.refresh(result);
		} catch (e) {
			if (mySeq !== fetchSeq) return;
			error =
				e instanceof Error
					? e.message
					: 'No se pudieron cargar las gasolineras.';
		} finally {
			if (mySeq === fetchSeq) loading = false;
		}
	}

	// ---------- Mount: auto-locate if permission already granted ----------
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

	// ---------- Reactive refetch on prefs change ----------
	let prevSig = $state('');
	$effect(() => {
		const sig = `${prefs.radiusKm}|${prefs.sort}|${prefs.fuels[0] ?? ''}`;
		if (sig === prevSig) return;
		prevSig = sig;
		if (!userPosition) return;
		loadStations();
	});

	// ---------- Refetch when position becomes known ----------
	let prevPosSig = $state('');
	$effect(() => {
		const posSig = userPosition ? `${userPosition.lat}|${userPosition.lng}` : '';
		if (posSig === prevPosSig) return;
		prevPosSig = posSig;
		if (!userPosition) return;
		loadStations();
	});

	function retry() {
		void loadStations();
	}
</script>

<svelte:head>
	<title>Gasolineras</title>
</svelte:head>

<main class="shell">
	<!-- Sticky header -->
	<header class="header">
		<h1 class="header-title">Gasolineras</h1>
		{#if !loading || stations.length > 0}
			<p class="header-subtitle">
				{prefs.favoritesOnly
					? `${visibleStations.length} ${visibleStations.length === 1 ? 'favorita' : 'favoritas'}`
					: `${visibleStations.length} en ${prefs.radiusKm} km`}
			</p>
		{:else}
			<p class="header-subtitle">&nbsp;</p>
		{/if}
	</header>

	<!-- Scrollable list area -->
	<div class="list-area">
		<!-- Welcome state: no position yet -->
		{#if !userPosition}
			{#if locateError}
				<div class="locate-error" role="alert">
					<span>{locateError}</span>
					<button class="locate-dismiss" onclick={() => (locateError = null)} aria-label="Cerrar">
						✕
					</button>
				</div>
			{/if}
			<div class="welcome">
				<Crosshair class="size-8 text-brand" />
				<h2 class="welcome-heading">Activa tu ubicación</h2>
				<p class="welcome-copy">
					Activa tu ubicación para ver las gasolineras más baratas cerca de ti
				</p>
				<button
					class="cta-btn"
					onclick={locateUser}
					disabled={locating}
					aria-label="Usar mi ubicación"
				>
					{#if locating}
						<span class="btn-spinner"></span>
					{/if}
					Usar mi ubicación
				</button>
				<p class="welcome-hint">Solo se usa en tu navegador, nada se envía al servidor</p>
			</div>

		<!-- First load spinner -->
		{:else if loading && stations.length === 0}
			<div class="center-state">
				<div class="loading-spinner"></div>
				<p class="center-text">Cargando gasolineras…</p>
			</div>

		<!-- Error state -->
		{:else if error && stations.length === 0}
			<div class="center-state">
				<p class="error-text">{error}</p>
				<button class="retry-btn" onclick={retry} aria-label="Reintentar carga de gasolineras">
					Reintentar
				</button>
			</div>

		<!-- Empty state -->
		{:else if visibleStations.length === 0}
			<div class="center-state">
				{#if prefs.favoritesOnly}
					<p class="empty-text">Aún no tienes gasolineras favoritas</p>
					<p class="center-text">Marca la estrella de una gasolinera para verla aquí</p>
				{:else}
					<p class="empty-text">Sin gasolineras en un radio de {prefs.radiusKm} km</p>
				{/if}
			</div>

		<!-- Station list -->
		{:else}
			<div class="station-list" aria-label="Lista de gasolineras">
				{#each visibleStations as station (station.id)}
					<StationCard {station} activeFuels={prefs.fuels} />
				{/each}
			</div>
		{/if}
	</div>
</main>

<style>
	.shell {
		position: fixed;
		inset: 0;
		display: flex;
		flex-direction: column;
	}

	/* Sticky header */
	.header {
		flex-shrink: 0;
		background: var(--card);
		padding: var(--space-page);
		border-bottom: 1px solid var(--border);
	}

	.header-title {
		font-size: 1rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		margin: 0;
	}

	.header-subtitle {
		font-size: 0.75rem;
		color: var(--muted-foreground);
		margin: 2px 0 0;
	}

	/* Scrollable list area */
	.list-area {
		flex: 1;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		padding: 0 var(--space-page) var(--space-page);
	}

	/* Welcome state */
	.welcome {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		gap: 0.75rem;
		padding: 2rem 1rem;
		min-height: 100%;
	}

	.welcome-heading {
		font-size: 1.125rem;
		font-weight: 700;
		margin: 0;
	}

	.welcome-copy {
		font-size: 0.875rem;
		color: var(--muted-foreground);
		max-width: 20rem;
		margin: 0;
	}

	.cta-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		background: var(--brand);
		color: var(--brand-foreground);
		border: none;
		border-radius: var(--radius-pill);
		padding: 0.625rem 1.25rem;
		font-size: 0.875rem;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		transition: filter var(--duration-fast) var(--ease-standard);
	}

	.cta-btn:hover {
		filter: brightness(0.93);
	}

	.cta-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.welcome-hint {
		font-size: 0.6875rem;
		color: var(--muted-foreground);
		margin: 0;
	}

	/* Center states (loading, error, empty) */
	.center-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		gap: 0.75rem;
		padding: 2rem 1rem;
		min-height: 100%;
	}

	.center-text {
		font-size: 0.875rem;
		color: var(--muted-foreground);
		margin: 0;
	}

	.error-text {
		font-size: 0.875rem;
		color: var(--destructive);
		margin: 0;
	}

	.empty-text {
		font-size: 0.875rem;
		color: var(--muted-foreground);
		margin: 0;
	}

	/* Station list */
	.station-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-stack);
		padding-top: var(--space-page);
	}

	/* Locate error pill */
	.locate-error {
		position: fixed;
		top: 4rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 100;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: var(--destructive);
		color: white;
		font-size: 0.75rem;
		font-weight: 500;
		padding: 0.4rem 0.75rem;
		border-radius: 999px;
		box-shadow: var(--shadow-md);
		max-width: 90%;
		text-align: center;
	}

	.locate-dismiss {
		background: none;
		border: none;
		color: white;
		font-size: 0.75rem;
		cursor: pointer;
		padding: 0;
		line-height: 1;
		opacity: 0.8;
	}

	.locate-dismiss:hover {
		opacity: 1;
	}

	/* Spinner */
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.loading-spinner {
		width: 1.5rem;
		height: 1.5rem;
		border: 2px solid var(--border);
		border-top-color: var(--brand);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	.btn-spinner {
		display: inline-block;
		width: 0.875rem;
		height: 0.875rem;
		border: 2px solid var(--brand-foreground);
		border-top-color: transparent;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	.retry-btn {
		padding: 0.5rem 1.25rem;
		border-radius: var(--radius-control);
		background: var(--foreground);
		color: var(--background);
		font-size: 0.875rem;
		font-weight: 600;
		font-family: inherit;
		border: none;
		cursor: pointer;
		transition: filter var(--duration-fast) var(--ease-standard);
	}

	.retry-btn:hover {
		filter: brightness(0.92);
	}
</style>
