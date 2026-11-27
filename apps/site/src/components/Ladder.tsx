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

export function Ladder({ states, width }: { states: readonly RungState[]; width: number }) {
  return (
    <ol
      className="ladder"
      style={{ width, flex: 'none', listStyle: 'none' }}
      aria-label="The pimp ladder"
    >
      {RUNGS.map((label, i) => (
        <li key={label} className={`rung ${states[i] ?? ''}`}>
          <span className="n num">{i + 1}</span>
          <span className="rl">{label}</span>
        </li>
      ))}
    </ol>
  );
}
