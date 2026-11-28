/** The pimp ladder's six rungs, bottom to top (DESIGN.md → Rung). */
export const RUNGS = [
  'Recall',
  'Next most common',
  'Tell it apart',
  'Workup',
  'Management',
  'Pearl',
] as const;

export type RungState = 'done' | 'now' | 'miss' | '';

/**
 * `labels` replaces the disease labels for drug, bug and pathway scripts
 * (DESIGN.md → Script kinds); the daily pimp passes them.
 */
export function Ladder({
  states,
  width,
  labels = RUNGS,
}: {
  states: readonly RungState[];
  width: number;
  labels?: readonly string[];
}) {
  return (
    <ol
      className="ladder"
      style={{ width, flex: 'none', listStyle: 'none' }}
      aria-label="The pimp ladder"
    >
      {labels.map((label, i) => (
        <li key={label} className={`rung ${states[i] ?? ''}`}>
          <span className="n num">{i + 1}</span>
          <span className="rl">{label}</span>
        </li>
      ))}
    </ol>
  );
}
