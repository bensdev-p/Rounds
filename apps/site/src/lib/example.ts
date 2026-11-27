/**
 * The site's worked example: acute pancreatitis, pimped on management (rung 5).
 * Questions and answers come from the site mockup, which traces to the script
 * mockup (domain rule 1). Used by How it works and the playing hero on Home.
 */
export const EXAMPLE_SCRIPT = 'Acute pancreatitis';

export const EXAMPLE_CLIMB: { q: string; a: string | null }[] = [
  {
    q: 'What are the two most common causes of acute pancreatitis?',
    a: '“Gallstones first, then heavy alcohol use.”',
  },
  {
    q: 'And the next most common cause after those?',
    a: '“Hypertriglyceridemia. It can also follow an ERCP.”',
  },
  {
    q: 'How would you tell gallstone pancreatitis from alcoholic pancreatitis at the bedside?',
    a: '“I’d check the ALT. If it’s more than three times normal, that points to gallstones, and then right upper quadrant…',
  },
  {
    q: 'How do you confirm the diagnosis?',
    a: '“Two of three: typical pain, lipase over three times normal, or imaging.”',
  },
  {
    q: 'Mild disease, pain controlled. What about feeding?',
    a: '“Keep them NPO until the pain resolves.”',
  },
  {
    q: 'Mild gallstone pancreatitis is settling. When should the gallbladder come out?',
    a: null,
  },
];

/** The rung the example misses on (0-based) and what the script says there. */
export const EXAMPLE_MISS = {
  rung: 4,
  label: 'Pimped on management',
  script: 'The script says early oral feeding as tolerated.',
};
