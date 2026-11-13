import {
  confusablesFor,
  isPimpable,
  type Confusable,
  type IllnessScript,
  type Question,
} from '@rounds/shared';
import { TEST_QUESTIONS, TEST_SCRIPTS } from '@rounds/shared/fixtures';

/**
 * The one place the app gets content from. Stage 1 scaffold: fictional
 * fixtures from @rounds/shared. Next step: read approved scripts and
 * questions from Supabase and parse them with the shared Zod schemas.
 */
/** Approved scripts that have at least one question to ask. */
export function getPimpableScripts(): IllnessScript[] {
  return TEST_SCRIPTS.filter((s) => isPimpable(s) && getQuestions(s.id).length > 0);
}

export function getScript(scriptId: string): IllnessScript | null {
  return getPimpableScripts().find((s) => s.id === scriptId) ?? null;
}

export function getQuestions(scriptId: string): Question[] {
  return TEST_QUESTIONS.filter((q) => q.script_id === scriptId);
}

export function getConfusables(script: IllnessScript): Confusable[] {
  return confusablesFor(script, TEST_SCRIPTS);
}
