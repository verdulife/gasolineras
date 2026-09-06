import Dialog from './dialog.svelte';
import type { Component } from 'svelte';

type DialogProps = Component<typeof Dialog>;

export { Dialog, type DialogProps };
export default Dialog;
