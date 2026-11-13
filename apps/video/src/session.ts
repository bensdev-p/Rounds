/* The session shown in the video: one acute pancreatitis ladder, climbed to
   rung 4 and missed on rung 5. Pure data and timing, no React.

   Every answer traces to the acute pancreatitis script in script.png:
   "Who gets it" (rungs 1–2), the mockup's own rung 3, "Diagnosis" (rung 4)
   and "Management" (rung 5, the miss explained on result.png). */

export interface Step {
  question: string;
  transcript: string;
  /** Frames before the question starts typing. */
  lead: number;
  /** Frames between the end of the question and the start of the answer. */
  think: number;
  /** Frames between the end of the answer and the verdict. */
  settle: number;
}

export const STEPS: readonly Step[] = [
  {
    question: 'What are the two most common causes of acute pancreatitis?',
    transcript: '"Gallstones first, then heavy alcohol use."',
    lead: 12,
    think: 10,
    settle: 50,
  },
  {
    question: 'And the next most common cause after those?',
    transcript: '"Hypertriglyceridemia. It can also follow an ERCP."',
    lead: 6,
    think: 8,
    settle: 12,
  },
  {
    question: 'How would you tell gallstone pancreatitis from alcoholic pancreatitis at the bedside?',
    transcript:
      '"I\'d check the ALT. If it\'s more than three times normal, that points to gallstones, and then right upper quadrant…',
    lead: 6,
    think: 8,
    settle: 30,
  },
  {
    question: 'How do you confirm the diagnosis?',
    transcript: '"Two of three: typical pain, lipase over three times normal, or imaging."',
    lead: 6,
    think: 8,
    settle: 12,
  },
  {
    question: 'Mild disease, pain controlled. What about feeding?',
    transcript: '"Keep them NPO until the pain resolves."',
    lead: 6,
    think: 8,
    settle: 14,
  },
];

/** The rung the student misses (1-based). Matches result.png. */
export const MISSED_RUNG = 5;

/** Typewriter at about 8 words a second (30 fps). */
export const QUESTION_FRAMES_PER_WORD = 30 / 8;
export const TRANSCRIPT_FRAMES_PER_WORD = 3.5;

export interface Beat {
  start: number;
  questionStart: number;
  questionEnd: number;
  answerStart: number;
  answerEnd: number;
  /** The rung pass (or, for the last step, the miss). The next step starts here. */
  verdict: number;
}

const words = (s: string): number => s.split(' ').length;

/** Lays the steps out one after another from `start`. Frames are whole numbers. */
export const buildSchedule = (start: number): Beat[] => {
  const beats: Beat[] = [];
  let cursor = start;
  for (const step of STEPS) {
    const questionStart = cursor + step.lead;
    const questionEnd = Math.ceil(questionStart + words(step.question) * QUESTION_FRAMES_PER_WORD);
    const answerStart = questionEnd + step.think;
    const answerEnd = Math.ceil(answerStart + words(step.transcript) * TRANSCRIPT_FRAMES_PER_WORD);
    const verdict = answerEnd + step.settle;
    beats.push({ start: cursor, questionStart, questionEnd, answerStart, answerEnd, verdict });
    cursor = verdict;
  }
  return beats;
};
