import type { Rotation } from '@rounds/shared';
import type { ScriptSummary } from '@rounds/shared/api';

/**
 * The student's current rotation. Until rotations can be chosen (onboarding
 * and Settings, M2.3), the first script's rotation is the current one.
 */
export function currentRotation(scripts: readonly ScriptSummary[]): Rotation {
  return scripts[0]?.script.rotation[0] ?? 'IM';
}
