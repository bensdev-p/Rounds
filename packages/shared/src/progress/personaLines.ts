/**
 * One short, dry line from the attending (DESIGN.md → Progression). Teases,
 * never gushes. Lines carry no medical facts, so they never need review.
 */
import type { PersonaId } from '../ladder/personas.ts';

/** `list_partial` / `list_full`: after a list question that passed with some or all answers. */
export type LineMoment = 'top' | 'promotion' | 'list_partial' | 'list_full';

const LINES: Record<PersonaId, Record<LineMoment, readonly [string, ...string[]]>> = {
  teacher: {
    top: ['That was the whole ladder. Nicely done.', 'Good. Now teach it to someone else.'],
    promotion: ['Well earned. Keep asking questions.', 'Congratulations. Keep reading every night.'],
    list_partial: ['Good start. Read up on the ones you missed.', 'Close. Look over the rest tonight.'],
    list_full: ['All of them. Well done.', 'Every one. Nicely done.'],
  },
  internist: {
    top: ['Fine. Same time tomorrow.', 'Adequate. Read around it anyway.'],
    promotion: [
      "Congratulations. You're still presenting to me at six.",
      "Noted. Don't let it go to your head.",
    ],
    list_partial: ['Some of them. Know the rest by tomorrow.', 'Partial. Read around it.'],
    list_full: ['Complete. As it should be.', 'All of them. Fine.'],
  },
  surgeon: {
    top: ['Good. Faster next time.', 'Fine. Next.'],
    promotion: ['Congratulations. Scrub in.', "Good. You still hold the retractor."],
    list_partial: ['Enough. Moving on.', 'Partial. Next.'],
    list_full: ['All of them. Next.', 'Good. Keep moving.'],
  },
};

/** A line for the moment. `seed` picks among a persona's lines, so a screen stays stable. */
export function personaLine(persona: PersonaId, moment: LineMoment, seed: number): string {
  const lines = LINES[persona][moment];
  return lines[Math.abs(Math.trunc(seed)) % lines.length] ?? lines[0];
}
