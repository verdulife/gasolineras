<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Card } from '$lib/components/ui/card';
	import { Dialog } from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Moon, Sun, Inbox, KeyRound, User, MapPin, X } from '@lucide/svelte';
	import type { FoundationShowcase, TokenShowcase } from '$lib/types/dsdd';

	let { data } = $props();

	const spec = $derived(data.spec);
	const buttonVariants = ['default', 'secondary', 'destructive', 'outline', 'ghost'] as const;

	let dark = $state(false);
	let showDialog = $state(false);

	$effect(() => {
		document.documentElement.classList.toggle('dark', dark);
	});

	function valueOf(t: TokenShowcase): string {
		return typeof t.value === 'string'
			? t.value
			: t.value === null || t.value === undefined
				? ''
				: String(t.value);
	}

	function foundationTokens(f: FoundationShowcase, group: string): TokenShowcase[] {
		return f.tokens.filter((t) => t.id.startsWith(`token:${f.foundation_kind}.${group}.`));
	}

	function findToken(f: FoundationShowcase, prefix: string): TokenShowcase | undefined {
		return f.tokens.find((t) => t.id.startsWith(`token:${f.foundation_kind}.${prefix}`));
	}

	function remValue(v: string): number {
		const m = /^([\d.]+)rem$/.exec(v.trim());
		return m ? parseFloat(m[1]) : 0;
	}

	interface ColorSwatch {
		group: string;
		name: string;
		light?: string;
		dark?: string;
	}

	function colorSwatches(f: FoundationShowcase): ColorSwatch[] {
		const map = new Map<string, ColorSwatch>();
		for (const t of f.tokens) {
			const m = /^token:colors\.([^.]+)\.(.+)\.(light|dark)$/.exec(t.id);
			if (!m) continue;
			const key = `${m[1]}.${m[2]}`;
			const entry = map.get(key) ?? { group: m[1], name: m[2] };
			if (m[3] === 'light') entry.light = valueOf(t);
			else entry.dark = valueOf(t);
			map.set(key, entry);
		}
		return [...map.values()];
	}

	interface TypeStep {
		name: string;
		size?: string;
		weight?: string;
		lineHeight?: string;
		letterSpacing?: string;
		use?: string;
	}

	function typeSteps(f: FoundationShowcase): TypeStep[] {
		const steps = new Map<string, TypeStep>();
		for (const t of f.tokens) {
			const m = /^token:typography\.scale\.([^.]+)\.([a-z-]+)$/.exec(t.id);
			if (!m) continue;
			const step = steps.get(m[1]) ?? { name: m[1] };
			const v = valueOf(t);
			if (m[2] === 'size') step.size = v;
			else if (m[2] === 'weight') step.weight = v;
			else if (m[2] === 'line-height') step.lineHeight = v;
			else if (m[2] === 'letter-spacing') step.letterSpacing = v;
			else if (m[2] === 'use') step.use = v;
			steps.set(m[1], step);
		}
		const order = ['display', 'heading', 'subheading', 'body', 'caption'];
		return order.map((n) => steps.get(n)).filter((s): s is TypeStep => s !== undefined);
	}

	interface SpaceToken {
		name: string;
		value: string;
	}

	function spacingList(f: FoundationShowcase, group: string): SpaceToken[] {
		return foundationTokens(f, group)
			.map((t) => ({ name: t.id.split('.').at(-1) ?? '', value: valueOf(t) }))
			.filter((s) => s.value.length > 0)
			.sort((a, b) => remValue(a.value) - remValue(b.value));
	}

	interface NameValue {
		name: string;
		value: string;
	}

	function nameValueList(f: FoundationShowcase, group: string): NameValue[] {
		return foundationTokens(f, group).map((t) => ({
			name: t.id.split('.').at(-1) ?? '',
			value: valueOf(t)
		}));
	}
</script>

<svelte:head>
	<title>Design System · Precio Gasolineras</title>
</svelte:head>

<div class="min-h-dvh bg-background text-foreground">
	<main class="mx-auto max-w-5xl px-4 py-8">
		{#if spec === null}
			<Card class="mx-auto mt-24 max-w-md text-center">
				<Inbox class="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
				<h1 class="text-xl font-semibold">Design System no generado</h1>
				<p class="mt-2 text-sm text-muted-foreground">
					Ejecuta el comando DSDD para generar <code>visual-ds/visual-spec.json</code>:
				</p>
				<code class="mt-3 block rounded-md bg-muted px-3 py-2 font-mono text-xs"
					>npx --no-install dsdd generate-visual-dsdd</code
				>
			</Card>
		{:else}
			<header class="flex flex-wrap items-start justify-between gap-4">
				<div>
					<p class="font-mono text-xs uppercase tracking-wide text-muted-foreground">
						Design System · {spec.source} · v{spec.version}
					</p>
					<h1 class="mt-1 text-3xl font-bold tracking-tight">Sistema de diseño</h1>
					<p class="mt-1 text-sm text-muted-foreground">
						{spec.conventions.styling.join(' + ')} · {spec.foundations.length} foundations ·
						{spec.components.length} componentes · {spec.patterns.length} patrones ·
						{spec.conventions.source_refs.length} fuentes canónicas
					</p>
				</div>
				<Button variant="outline" onclick={() => (dark = !dark)}>
					{#if dark}<Sun class="h-4 w-4" /> Light{:else}<Moon class="h-4 w-4" /> Dark{/if}
				</Button>
			</header>

			<section class="mt-8 space-y-8">
				{#each spec.foundations as f (f.entity.id)}
					<Card class="overflow-hidden p-0">
						<div class="flex items-baseline justify-between gap-2 border-b px-6 py-4">
							<h2 class="text-xl font-semibold capitalize">{f.foundation_kind}</h2>
							<span class="font-mono text-xs text-muted-foreground">
								{f.representation} · {f.entity.status} · {f.entity.maturity}
							</span>
						</div>

						<div class="px-6 py-5">
							{#if f.foundation_kind === 'colors'}
								<div class="space-y-3">
									{#each colorSwatches(f) as s}
										<div class="flex items-center gap-4">
											<div
												class="h-12 w-12 shrink-0 rounded-md ring-1 ring-black/10 dark:ring-white/20"
												style="background-color:{s.light}"
												title={s.light}
											></div>
											<div
												class="h-12 w-12 shrink-0 rounded-md ring-1 ring-black/10 dark:ring-white/20"
												style="background-color:{s.dark}"
												title={s.dark}
											></div>
											<div class="min-w-0">
												<p class="truncate text-sm font-medium">{s.name}</p>
												<p class="truncate font-mono text-xs text-muted-foreground">
													{s.group} · {s.light} / {s.dark}
												</p>
											</div>
										</div>
									{/each}
									{#if findToken(f, 'format')}
										<p class="pt-2 text-xs text-muted-foreground">
											Formato:
											<span class="font-mono">{valueOf(findToken(f, 'format')!)}</span>
										</p>
									{/if}
								</div>
							{:else if f.foundation_kind === 'typography'}
								{#if findToken(f, 'family.sans')}
									<p class="mb-4 text-xs text-muted-foreground">
										Familia:
										<span class="font-mono">{valueOf(findToken(f, 'family.sans')!)}</span>
									</p>
								{/if}
								<div class="space-y-5">
									{#each typeSteps(f) as step}
										<div>
											<p
												class="tabular-nums"
												style="font-size:{step.size};font-weight:{step.weight};line-height:{step.lineHeight};letter-spacing:{step.letterSpacing}"
											>
												Precio gasolina 95 · 1,299 €/L
											</p>
											<p class="mt-1 text-xs text-muted-foreground">
												<span class="font-mono capitalize">{step.name}</span>
												{step.use ? ` · ${step.use}` : ''}
												<span class="font-mono"> · {step.size} / {step.weight} / {step.lineHeight}</span>
											</p>
										</div>
									{/each}
								</div>
							{:else if f.foundation_kind === 'spacing'}
								<div class="space-y-6">
									<div>
										<p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
											Escala
										</p>
										<div class="space-y-2">
											{#each spacingList(f, 'scale') as s}
												<div class="flex items-center gap-3">
													<div class="h-6 rounded-sm bg-primary" style="width:{s.value}"></div>
													<p class="shrink-0 font-mono text-xs text-muted-foreground">
														{s.name} · {s.value}
													</p>
												</div>
											{/each}
										</div>
									</div>
									<div>
										<p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
											Semántico
										</p>
										<div class="flex flex-wrap gap-x-6 gap-y-3">
											{#each spacingList(f, 'semantic') as s}
												<div class="flex items-center gap-2">
													<div class="h-6 w-6 rounded-sm bg-primary" style="width:{s.value}"></div>
													<p class="font-mono text-xs text-muted-foreground">{s.name} · {s.value}</p>
												</div>
											{/each}
										</div>
									</div>
								</div>
							{:else if f.foundation_kind === 'radius'}
								<div class="space-y-4">
									<div class="flex flex-wrap gap-4">
										{#each [...nameValueList(f, 'scale'), ...nameValueList(f, 'semantic')] as r}
											<div
												class="h-16 w-24 border bg-muted/40"
												style="border-radius:{r.value}"
											>
												<p class="p-1 text-center font-mono text-[10px] leading-tight text-muted-foreground">
													{r.name}
													<br />{r.value}
												</p>
											</div>
										{/each}
									</div>
									{#if findToken(f, 'base')}
										<p class="pt-2 text-xs text-muted-foreground">
											Base: <span class="font-mono">{valueOf(findToken(f, 'base')!)}</span>
										</p>
									{/if}
								</div>
							{:else if f.foundation_kind === 'shadows'}
								<div class="flex flex-wrap gap-5">
									{#each [...nameValueList(f, 'scale'), ...nameValueList(f, 'semantic')] as sh}
										<div
											class="flex h-20 w-32 items-center justify-center rounded-md border bg-card text-center"
											style="box-shadow:{sh.value}"
										>
											<p class="font-mono text-xs text-muted-foreground">
												{sh.name}
												<br />{sh.value}
											</p>
										</div>
									{/each}
								</div>
							{:else if f.foundation_kind === 'motion'}
								<div class="space-y-5">
									<div class="flex flex-wrap gap-2">
										{#each nameValueList(f, 'durations') as m}
											<span
												class="rounded-[var(--radius-control)] border px-3 py-1 font-mono text-xs"
											>
												{m.name} · {m.value}
											</span>
										{/each}
									</div>
									<div class="flex flex-wrap gap-2">
										{#each nameValueList(f, 'easings') as m}
											<span
												class="rounded-[var(--radius-control)] bg-muted px-3 py-1 font-mono text-xs"
											>
												{m.name} · {m.value}
											</span>
										{/each}
									</div>
									<p class="text-xs text-muted-foreground">
										Semántico:
										<span class="font-mono">
											{#each nameValueList(f, 'semantic') as m}{m.name} · {m.value}; {/each}
										</span>
									</p>
									{#if findToken(f, 'accessibility.reduced-motion')}
										<p class="text-xs text-muted-foreground">
											Reduced motion:
											<span class="font-mono">
												{String(findToken(f, 'accessibility.reduced-motion')!.value)}
											</span>
										</p>
									{/if}
								</div>
							{:else if f.foundation_kind === 'breakpoints'}
								<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
									{#each nameValueList(f, 'scale') as b}
										<div class="rounded-[var(--radius-control)] border p-3">
											<p class="font-mono text-lg font-semibold">{b.name}</p>
											<p class="font-mono text-xs text-muted-foreground">{b.value}</p>
										</div>
									{/each}
								</div>
								<p class="mt-3 text-xs text-muted-foreground">
									Semántico:
									<span class="font-mono">
										{#each nameValueList(f, 'semantic') as b}{b.name} · {b.value}; {/each}
									</span>
								</p>
							{:else if f.foundation_kind === 'focus'}
								{@const ringWidth = findToken(f, 'ring.width')}
								{@const ringOffset = findToken(f, 'ring.offset')}
								{@const focusVisible = findToken(f, 'visibility.focus-visible-only')}
								<div class="space-y-4">
									<p class="text-xs text-muted-foreground">
										Ring: width
										<span class="font-mono">{ringWidth ? valueOf(ringWidth) : '—'}</span>
										· offset
										<span class="font-mono">{ringOffset ? valueOf(ringOffset) : '—'}</span>
									</p>
									<div class="rounded-md border p-4">
										<p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
											Demo :focus-visible
										</p>
										<Input placeholder="Pulsa Tab para ver el anillo" class="max-w-xs" />
									</div>
									<p class="text-xs text-muted-foreground">
										Focus visible only:
										<span class="font-mono">{focusVisible ? String(focusVisible.value) : '—'}</span>
									</p>
								</div>
							{:else}
								<div class="space-y-2">
									{#each f.tokens as t (t.id)}
										<p class="font-mono text-xs">
											<span class="text-muted-foreground">{t.id}</span>
											<span class="ml-2">{valueOf(t)}</span>
										</p>
									{/each}
								</div>
							{/if}
						</div>
					</Card>
				{/each}
			</section>

			<section class="mt-10">
				<h2 class="text-2xl font-bold tracking-tight">Componentes</h2>
				<p class="mt-1 text-sm text-muted-foreground">
					Componentes canónicos del sistema, renderizados con sus tokens.
				</p>

				<div class="mt-5 space-y-8">
					<Card class="overflow-hidden p-0">
						<div class="border-b px-6 py-4">
							<h3 class="text-lg font-semibold">Button</h3>
						</div>
						<div class="space-y-5 px-6 py-5">
							<div class="flex flex-wrap gap-3">
								{#each buttonVariants as variant}
									<Button {variant}>{variant.charAt(0).toUpperCase() + variant.slice(1)}</Button>
								{/each}
							</div>
							<div class="flex flex-wrap items-center gap-3">
								<Button size="sm">Pequeño</Button>
								<Button>Normal</Button>
								<Button size="lg">Grande</Button>
								<Button size="icon" aria-label="Mapa"><MapPin class="h-4 w-4" /></Button>
							</div>
							<div class="flex flex-wrap gap-3">
								<Button disabled>Deshabilitado</Button>
								<Button variant="outline" disabled>Outline deshabilitado</Button>
							</div>
						</div>
					</Card>

					<Card class="overflow-hidden p-0">
						<div class="border-b px-6 py-4">
							<h3 class="text-lg font-semibold">Input</h3>
						</div>
						<div class="grid gap-4 px-6 py-5 sm:grid-cols-3">
							<div>
								<Input placeholder="Texto normal" />
							</div>
							<div>
								<Input placeholder="Con placeholder" value="Con valor" />
							</div>
							<div>
								<Input placeholder="Deshabilitado" disabled />
							</div>
						</div>
					</Card>

					<Card class="overflow-hidden p-0">
						<div class="border-b px-6 py-4">
							<h3 class="text-lg font-semibold">Card</h3>
						</div>
						<div class="px-6 py-5">
							<Card class="max-w-sm shadow-card">
								<p class="text-sm font-semibold">Repsol · Madrid</p>
								<p class="mt-1 font-mono text-3xl font-bold tabular-nums">1,299 €/L</p>
								<p class="mt-1 text-xs text-muted-foreground">Gasolina 95 · actualizado hace 5 min</p>
								<Button class="mt-4 w-full">Ver estación</Button>
							</Card>
						</div>
					</Card>

					<Card class="overflow-hidden p-0">
						<div class="flex items-center justify-between border-b px-6 py-4">
							<h3 class="text-lg font-semibold">Dialog</h3>
							<Button onclick={() => (showDialog = true)}>Abrir diálogo</Button>
						</div>
						<div class="px-6 py-5 text-sm text-muted-foreground">
							Diálogo modal centrado con backdrop.
						</div>
					</Card>
				</div>
			</section>

			<section class="mt-10">
				<h2 class="text-2xl font-bold tracking-tight">Patrones</h2>

				<div class="mt-5 grid gap-6 md:grid-cols-2">
					{#each spec.patterns as p (p.entity.id)}
						<Card class="overflow-hidden p-0">
							<div class="border-b px-6 py-4">
								<h3 class="text-lg font-semibold capitalize">{p.entity.id}</h3>
							</div>
							<div class="px-6 py-5">
								{#if p.entity.id === 'empty-state'}
									<div class="flex flex-col items-center py-6 text-center">
										<Inbox class="mb-3 h-10 w-10 text-muted-foreground" />
										<p class="text-base font-semibold">Sin resultados</p>
										<p class="mt-1 max-w-xs text-sm text-muted-foreground">
											No se han encontrado estaciones en esta zona. Ajusta la búsqueda o prueba otra área.
										</p>
										<Button class="mt-4" variant="outline">Buscar de nuevo</Button>
									</div>
								{:else if p.entity.id === 'authentication'}
									<div class="space-y-4 py-2">
										<div class="space-y-1">
											<label class="text-sm font-medium" for="ds-email">Email</label>
											<Input id="ds-email" type="email" placeholder="tu@email.com" />
										</div>
										<div class="space-y-1">
											<label class="text-sm font-medium" for="ds-password">Contraseña</label>
											<Input id="ds-password" type="password" placeholder="••••••••" />
										</div>
										<Button class="w-full">
											<KeyRound class="h-4 w-4" /> Iniciar sesión
										</Button>
										<Button class="w-full" variant="outline">
											<User class="h-4 w-4" /> Crear cuenta
										</Button>
									</div>
								{:else}
									<p class="text-sm text-muted-foreground">
										Composición: {p.composition.length} referencias
									</p>
								{/if}
							</div>
						</Card>
					{/each}
				</div>
			</section>

			<footer class="mt-12 border-t py-6 text-center">
				<p class="font-mono text-xs text-muted-foreground">
					Generado por DSDD · {spec.id} · framework-neutral
				</p>
			</footer>
		{/if}
	</main>
</div>

{#if showDialog}
	<div
		class="fixed inset-0 z-40 bg-black/50"
		role="presentation"
		onclick={() => (showDialog = false)}
	></div>
	<Dialog class="relative">
		<button
			type="button"
			class="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-muted"
			onclick={() => (showDialog = false)}
			aria-label="Cerrar"
		>
			<X class="h-4 w-4" />
		</button>
		<h3 class="text-lg font-semibold">Detalle de estación</h3>
		<p class="mt-2 text-sm text-muted-foreground">
			Diálogo modal construido con el componente canónico y sus tokens de radius, shadow y motion.
		</p>
		<div class="mt-4 flex justify-end gap-3">
			<Button variant="ghost" onclick={() => (showDialog = false)}>Cancelar</Button>
			<Button onclick={() => (showDialog = false)}>Aceptar</Button>
		</div>
	</Dialog>
{/if}