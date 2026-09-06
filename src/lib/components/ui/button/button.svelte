<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Variant = 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost';
	type Size = 'default' | 'sm' | 'lg' | 'icon';

	let {
		variant = 'default',
		size = 'default',
		class: klass,
		disabled = false,
		type = 'button',
		children,
		...rest
	}: {
		variant?: Variant;
		size?: Size;
		class?: string;
		disabled?: boolean;
		type?: 'button' | 'submit' | 'reset';
		children?: Snippet;
	} & HTMLButtonAttributes = $props();

	const variants: Record<Variant, string> = {
		default:
			'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
		secondary:
			'bg-secondary text-secondary-foreground hover:bg-secondary/80',
		destructive:
			'bg-destructive text-white hover:bg-destructive/90 shadow-sm',
		outline:
			'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
		ghost: 'hover:bg-accent hover:text-accent-foreground'
	};

	const sizes: Record<Size, string> = {
		default: 'h-10 px-4 py-2',
		sm: 'h-9 px-3 text-sm',
		lg: 'h-11 px-8',
		icon: 'h-10 w-10'
	};
</script>

<button
	{type}
	{disabled}
	class={cn(
		'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)]',
		'font-medium no-underline transition-colors duration-150',
		'focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
		variants[variant],
		sizes[size],
		klass
	)}
	{...rest}
>
	{@render children?.()}
</button>
