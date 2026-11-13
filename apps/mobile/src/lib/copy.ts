/** Small copy helpers shared by screens. Plain words, no guilt (DESIGN.md → Voice and copy). */
import type { Rotation, RoundsToday, ShiftStreak } from '@rounds/shared';

export const ROTATION_NAMES: Record<Rotation, string> = {
  IM: 'Internal medicine',
  surgery: 'Surgery',
  peds: 'Pediatrics',
  obgyn: 'OB/GYN',
  psych: 'Psychiatry',
  neuro: 'Neurology',
  FM: 'Family medicine',
  EM: 'Emergency medicine',
};

export const plural = (n: number, one: string, many = `${one}s`): string =>
  `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

/** The one streak line under Today's rounds. A reset is never mentioned. */
export function streakLine(rounds: RoundsToday, streak: ShiftStreak): string {
  if (streak.today) {
    return streak.count === 1 ? 'Rounds done. First shift.' : `Rounds done. ${streak.count} shifts in a row.`;
  }
  if (streak.count > 0) {
    return `${plural(streak.count, 'shift')} in a row. Finish rounds to make it ${streak.count + 1}.`;
  }
  const left = rounds.goal - rounds.done;
  return rounds.done === 0
    ? `Finish ${plural(rounds.goal, 'session')} to count today as a shift.`
    : `${plural(left, 'more session')} to finish rounds today.`;
}

export function todayLabel(now: Date): string {
  return now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
