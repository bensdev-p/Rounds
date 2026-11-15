import { z } from 'zod';

/** Ladder rungs, lowest to highest. Order matters: the ladder climbs this list. */
export const RUNGS = [
  'recall',
  'second_order',
  'differentiate',
  'workup',
  'management',
  'pearl',
] as const;
export const RungSchema = z.enum(RUNGS);
export type Rung = z.infer<typeof RungSchema>;

export function rungIndex(rung: Rung): number {
  return RUNGS.indexOf(rung);
}
