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
		'rounded-[var(--radius-card)] border bg-card p-[var(--space-card-padding)] text-card-foreground shadow-card',
		klass
	)}
	{...rest}
>
	{@render children?.()}
</div>
