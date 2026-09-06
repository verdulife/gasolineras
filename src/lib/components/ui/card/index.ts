import Card from './card.svelte';
import type { Component } from 'svelte';

type CardProps = Component<typeof Card>;

export { Card, type CardProps };
export default Card;
