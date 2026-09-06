<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		class: klass,
		children,
		...rest
	}: { class?: string; children?: Snippet } & HTMLAttributes<HTMLDivElement> = $props();
</script>

<div
	class={cn(
		'fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2',
		'rounded-[var(--radius-card)] border bg-card p-[var(--space-card-padding)] text-card-foreground shadow-dialog',
		'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-slow',
		klass
	)}
	role="dialog"
	aria-modal="true"
	{...rest}
>
	{@render children?.()}
</div>
