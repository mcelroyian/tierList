import data from './data.json';

export const TIERS = data.tiers;
export type TierId = (typeof TIERS)[number];
