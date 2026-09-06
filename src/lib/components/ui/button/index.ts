import Button from './button.svelte';
import type { Component } from 'svelte';

type ButtonProps = Component<typeof Button>;

export { Button, type ButtonProps };
export default Button;
