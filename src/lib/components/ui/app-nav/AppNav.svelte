<script lang="ts">
	import { page } from '$app/state';
	import { List, Map as MapIcon } from '@lucide/svelte';

	const items = [
		{ href: '/', label: 'Lista', icon: List },
		{ href: '/mapa', label: 'Mapa', icon: MapIcon }
	] as const;
</script>

<nav class="app-nav" aria-label="Navegación">
	<div class="seg">
		{#each items as item (item.href)}
			<a
				class="seg-item"
				class:active={page.url.pathname === item.href}
				href={item.href}
				aria-current={page.url.pathname === item.href ? 'page' : undefined}
			>
				<item.icon class="size-3.5" />
				{item.label}
			</a>
		{/each}
	</div>
</nav>

<style>
	.app-nav {
		flex-shrink: 0;
		position: sticky;
		top: 0;
		z-index: 1100;
		display: flex;
		justify-content: center;
		padding: var(--space-inline) var(--space-page);
		background: var(--card);
		border-bottom: 1px solid var(--border);
	}

	.seg {
		display: flex;
		gap: 0.25rem;
		background: var(--muted);
		border-radius: var(--radius-pill);
		padding: 0.25rem;
	}

	.seg-item {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.4rem 1.125rem;
		border-radius: var(--radius-pill);
		color: var(--muted-foreground);
		font-size: 0.8125rem;
		font-weight: 600;
		text-decoration: none;
		white-space: nowrap;
		transition: all var(--duration-fast) var(--ease-standard);
	}

	.seg-item:hover {
		color: var(--foreground);
	}

	.seg-item.active {
		background: var(--card);
		color: var(--foreground);
		box-shadow: var(--shadow-sm);
	}
</style>