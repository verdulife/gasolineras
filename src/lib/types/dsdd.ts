export interface SpecConventions {
	framework_neutral: boolean;
	token_policy: string;
	arbitrary_values_allowed: boolean;
	styling: string[];
	source_refs: string[];
}

export interface EntityInfo {
	id: string;
	type: 'foundation' | 'component' | 'pattern';
	path: string;
	scope: string;
	status: string;
	canonical: boolean;
	maturity: string;
}

export interface TokenReference {
	path: string;
}

export interface TokenShowcase {
	id: string;
	status: string;
	source_refs: string[];
	reference: TokenReference;
	value?: unknown;
}

export interface ProvenanceItem {
	path: string;
	detail: string;
	status: string;
}

export interface RenderDescription {
	mode: string;
	subject_ref: string;
	props: Record<string, unknown>;
	slots: unknown[];
	token_refs: unknown[];
}

export interface FoundationShowcase {
	id: string;
	kind: 'foundation-showcase';
	entity: EntityInfo;
	foundation_kind: string;
	representation: string;
	tokens: TokenShowcase[];
}

export interface ComponentShowcase {
	id: string;
	kind: 'component-showcase';
	entity: EntityInfo;
	name?: string;
	description?: string | null;
	variants: unknown[];
	states: unknown[];
	sizes: unknown[];
	capabilities: Record<string, unknown>;
	tokens_used: TokenShowcase[];
	provenance: ProvenanceItem[];
	render: RenderDescription;
	showcase?: { kind: string; views: unknown[] };
}

export interface PatternShowcase {
	id: string;
	kind: 'pattern-showcase';
	entity: EntityInfo;
	description?: string | null;
	composition: unknown[];
	constraints: unknown[];
	layout?: unknown;
	examples: unknown[];
	provenance: ProvenanceItem[];
	render: RenderDescription;
	showcase?: { kind: string; views: unknown[] };
}

export interface VisualReference {
	from: string;
	to: string;
	relationship: string;
}

export interface VisualSpec {
	id: string;
	version: string;
	framework: string;
	source: string;
	conventions: SpecConventions;
	foundations: FoundationShowcase[];
	components: ComponentShowcase[];
	patterns: PatternShowcase[];
	references: VisualReference[];
}