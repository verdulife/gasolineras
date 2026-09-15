<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { GasStation } from '$lib/types';
	import 'leaflet/dist/leaflet.css';
	import type * as LLeaflet from 'leaflet';

	export interface Bounds {
		swLat: number;
		swLng: number;
		neLat: number;
		neLng: number;
	}

	interface Props {
		stations: GasStation[];
		selectedId?: string | null;
		userLocation?: { lat: number; lng: number } | null;
		onselect?: (station: GasStation) => void;
		onboundschange?: (bounds: Bounds) => void;
		center?: [number, number];
		zoom?: number;
	}

	let {
		stations,
		selectedId = $bindable(null),
		userLocation = $bindable(null),
		onselect,
		onboundschange,
		center = [41.3874, 2.1686],
		zoom = 13
	}: Props = $props();

	let mapEl: HTMLDivElement | undefined = $state(undefined);
	let L: typeof import('leaflet') | undefined;
	let map: LLeaflet.Map | undefined;
	/** Reactive readiness flag so effects re-run once the map exists. */
	let mapReady = $state(false);
	let markers = new Map<string, LLeaflet.Marker>();
	let userMarker: LLeaflet.CircleMarker | null = null;
	let boundsTimer: ReturnType<typeof setTimeout> | undefined;
	let prevSelectedId: string | null = null;

	// Custom marker icon with price badge. Leaflet types imported as `Leaflet`.
	function createPriceIcon(
		leaflet: typeof import('leaflet'),
		price: number | undefined,
		isSelected: boolean
	): LLeaflet.DivIcon {
		const priceStr = price != null ? price.toFixed(3) : '—';
		const bg = 'var(--card)';
		const border = isSelected ? '2px solid var(--brand)' : '1px solid var(--border)';
		const textColor = 'var(--foreground)';
		const scale = isSelected ? 'scale(1.15)' : 'scale(1)';
		const shadow = isSelected
			? '0 0 0 3px var(--brand), 0 4px 12px rgba(0,0,0,0.35)'
			: '0 2px 6px rgba(0,0,0,0.15)';

		return leaflet.divIcon({
			className: 'price-marker',
			iconSize: [0, 0],
			iconAnchor: [30, 12],
			html: `
				<div style="
					transform: ${scale};
					transition: transform 0.2s ease, box-shadow 0.2s ease;
					display: flex;
					align-items: center;
					justify-content: center;
					transform-origin: center;
				">
					<div style="
						background: ${bg};
						color: ${textColor};
						border: ${border};
						font-family: 'Inter Variable', system-ui, sans-serif;
						font-size: 11px;
						font-weight: 700;
						padding: 4px 8px;
						border-radius: 20px;
						white-space: nowrap;
						box-shadow: ${shadow};
						letter-spacing: -0.02em;
						font-variant-numeric: tabular-nums;
					">${priceStr} €</div>
				</div>
			`
		});
	}

	function updateMarkers(stationList: GasStation[], leaflet: typeof import('leaflet')) {
		if (!map || !leaflet) return;
		const mapRef = map;
		markers.forEach((m) => m.remove());
		markers.clear();

		stationList.forEach((station) => {
			const icon = createPriceIcon(leaflet, station.prices.gasolina95, station.id === selectedId);
			const marker = leaflet
				.marker([station.lat, station.lng], { icon })
				.addTo(mapRef)
				.on('click', () => {
					if (selectedId === station.id) {
						// Already selected -> toggle off (deselect).
						selectedId = null;
					} else {
						selectedId = station.id;
						onselect?.(station);
					}
				});
			markers.set(station.id, marker);
		});
	}

	function flyToStation(station: GasStation) {
		if (!map) return;
		map.flyTo([station.lat, station.lng], 16, { duration: 0.8 });
	}

	function scheduleBounds() {
		if (!map) return;
		clearTimeout(boundsTimer);
		boundsTimer = setTimeout(() => {
			if (!map) return;
			const b = map.getBounds();
			onboundschange?.({
				swLat: b.getSouth(),
				swLng: b.getWest(),
				neLat: b.getNorth(),
				neLng: b.getEast()
			});
		}, 400);
	}

	onMount(async () => {
		if (!mapEl) return;
		const leaflet = await import('leaflet');
		L = leaflet;

		map = leaflet.map(mapEl, {
			center,
			zoom,
			zoomControl: false,
			attributionControl: false
		});

		leaflet
			.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
				maxZoom: 19,
				attribution:
					'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
			})
			.addTo(map);

		leaflet.control.attribution({ position: 'bottomleft', prefix: '' }).addTo(map);

		// Clicking the map background clears the selection (marker clicks stop propagation).
		map.on('click', () => {
			selectedId = null;
		});

		updateMarkers(stations, leaflet);
		scheduleBounds();

		// Debounced viewport change: emit the current bounds so the page
		// can load stations for the visible zone.
		map.on('moveend zoomend', scheduleBounds);
		mapReady = true;
	});

	onDestroy(() => {
		clearTimeout(boundsTimer);
		map?.remove();
		map = undefined;
	});

	// Show / move the user location marker (GPS)
	$effect(() => {
		const loc = userLocation; // reactive dependency read first
		const ready = mapReady;
		if (!ready || !map || !L) return;
		if (!loc) {
			userMarker?.remove();
			userMarker = null;
			return;
		}
		if (!userMarker) {
			userMarker = L.circleMarker([loc.lat, loc.lng], {
				radius: 9,
				color: '#ffffff',
				weight: 3,
				fillColor: '#2563eb',
				fillOpacity: 1
			})
				.addTo(map)
				.bindPopup('Estás aquí');
		} else {
			userMarker.setLatLng([loc.lat, loc.lng]);
		}
		map.flyTo([loc.lat, loc.lng], 15, { duration: 0.9 });
	});

	// Fly to the station ONLY when the selection actually changes. Otherwise the
	// flyTo -> moveend -> onboundschange -> loadZone -> stations change chain
	// would re-trigger this effect and loop forever (map trembling).
	$effect(() => {
		const sel = selectedId; // reactive dependency read first
		if (!map || !L) return;
		if (sel !== prevSelectedId) {
			prevSelectedId = sel;
			if (sel) {
				const station = stations.find((s) => s.id === sel);
				if (station) flyToStation(station);
			}
		}
	});

	// Reactively update marker icons when selection changes
	$effect(() => {
		const list = stations; // reactive dependency read first
		const sel = selectedId;
		if (!map || !L) return;
		const _L = L;
		list.forEach((station) => {
			const marker = markers.get(station.id);
			if (marker) {
				marker.setIcon(createPriceIcon(_L, station.prices.gasolina95, station.id === sel));
			}
		});
	});

	// Update markers when station list changes
	$effect(() => {
		const list = stations; // reactive dependency read first
		if (!map || !L) return;
		updateMarkers(list, L);
	});
</script>

<div bind:this={mapEl} class="map-container"></div>

<style>
	.map-container {
		width: 100%;
		height: 100%;
		position: absolute;
		inset: 0;
		z-index: 0;
	}

	:global(.price-marker) {
		background: none !important;
		border: none !important;
	}
</style>