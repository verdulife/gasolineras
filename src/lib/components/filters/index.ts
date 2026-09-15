import FilterPanel from './FilterPanel.svelte';
import type { Component } from 'svelte';

type FilterPanelProps = Component<typeof FilterPanel>;

export { FilterPanel, type FilterPanelProps };
export default FilterPanel;