<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HTMLInputAttributes } from 'svelte/elements';

	let {
		class: klass,
		type = 'text',
		...rest
	}: { class?: string; type?: string } & HTMLInputAttributes = $props();
</script>

<input
	{type}
	class={cn(
		'flex h-10 w-full rounded-[var(--radius-control)] border border-input bg-background px-3 py-2',
		'text-base transition-colors duration-150 placeholder:text-muted-foreground',
		'focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
		klass
	)}
	{...rest}
/>
