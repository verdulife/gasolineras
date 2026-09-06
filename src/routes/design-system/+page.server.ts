import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { VisualSpec } from '$lib/types/dsdd';

export async function load() {
	const file = join(process.cwd(), 'visual-ds', 'visual-spec.json');
	try {
		const raw = await readFile(file, 'utf8');
		const spec = JSON.parse(raw) as VisualSpec;
		return { spec };
	} catch {
		return { spec: null };
	}
}