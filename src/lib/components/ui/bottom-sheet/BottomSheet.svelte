<script lang="ts">
	export type SheetLevel = 'peek' | 'medium' | 'full';

	interface Props {
		level?: 'peek' | 'medium' | 'full';
		peekHeight?: number;
		mediumHeight?: number;
		children?: import('svelte').Snippet;
		peekContent?: import('svelte').Snippet;
		onchange?: (level: 'peek' | 'medium' | 'full') => void;
	}

	let {
		level = $bindable('peek'),
		peekHeight = 60,
		mediumHeight = 440,
		children,
		peekContent,
		onchange
	}: Props = $props();

	let sheetEl: HTMLDivElement | undefined = $state(undefined);
	let handleEl: HTMLDivElement | undefined = $state(undefined);
	let dragStartY = $state(0);
	let dragStartHeight = $state(0);
	let currentHeight = $state(60);
	let pointerId = $state(-1);
	let isDragging = $state(false);

	function snapHeight(lvl: 'peek' | 'medium' | 'full'): number {
		if (lvl === 'full') return window.innerHeight;
		return lvl === 'medium' ? mediumHeight : peekHeight;
	}

	function handlePointerDown(e: PointerEvent) {
		if (!handleEl) return;
		isDragging = true;
		pointerId = e.pointerId;
		dragStartY = e.clientY;
		dragStartHeight = currentHeight;
		handleEl.setPointerCapture(e.pointerId);
	}

	function handlePointerMove(e: PointerEvent) {
		if (!isDragging) return;
		const delta = dragStartY - e.clientY;
		currentHeight = Math.max(peekHeight, Math.min(window.innerHeight, dragStartHeight + delta));
	}

	function handlePointerUp() {
		if (!isDragging) return;
		isDragging = false;
		try {
			handleEl?.releasePointerCapture(pointerId);
		} catch {
			// ignore
		}

		const fullPx = window.innerHeight;
		const ranges: { level: 'peek' | 'medium' | 'full'; mid: number }[] = [
			{ level: 'peek', mid: peekHeight / 2 },
			{ level: 'medium', mid: (peekHeight + mediumHeight) / 2 },
			{ level: 'full', mid: (mediumHeight + fullPx) / 2 }
		];

		let closest = ranges[0];
		let minDist = Infinity;
		for (const r of ranges) {
			const dist = Math.abs(currentHeight - r.mid);
			if (dist < minDist) {
				minDist = dist;
				closest = r;
			}
		}

		level = closest.level;
		currentHeight = snapHeight(closest.level);
		onchange?.(closest.level);
	}

	// Keep height in sync when the level is set externally
	$effect(() => {
		currentHeight = snapHeight(level);
	});
</script>

<div
	bind:this={sheetEl}
	class="bottom-sheet"
	class:dragging={isDragging}
	style="height: {currentHeight}px;"
	role="region"
	aria-label="Panel de estaciones"
>
	<div
		bind:this={handleEl}
		class="handle-area"
		onpointerdown={handlePointerDown}
		onpointermove={handlePointerMove}
		onpointerup={handlePointerUp}
		onpointercancel={handlePointerUp}
		role="button"
		tabindex="0"
		aria-label="Arrastrar para cambiar el tamaño"
	>
		<div class="handle-bar"></div>
	</div>

	<div class="sheet-content">
		{#if level === 'peek'}
			{@render peekContent?.()}
		{:else}
			{@render children?.()}
		{/if}
	</div>
</div>

<style>
	.bottom-sheet {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 1000;
		background: var(--card);
		border-radius: 1rem 1rem 0 0;
		box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.12);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
		will-change: height;
		transition: height 0.3s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.bottom-sheet.dragging {
		transition: none;
	}

	.handle-area {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.625rem 0 0.5rem;
		cursor: grab;
		background: transparent;
		border: none;
		width: 100%;
		touch-action: none;
		flex-shrink: 0;
	}

	.handle-area:active {
		cursor: grabbing;
	}

	.handle-bar {
		width: 2.75rem;
		height: 0.3rem;
		border-radius: 999px;
		background: var(--muted-foreground);
		opacity: 0.4;
	}

	.sheet-content {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 0 1rem 1rem;
		-webkit-overflow-scrolling: touch;
	}
</style>