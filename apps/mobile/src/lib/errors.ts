/**
 * Turns a load failure into words a student can act on. Stage 1 runs on a
 * computer at home, so the usual cause is that computer being off, or the
 * phone being off the home Wi-Fi.
 */
const OFFLINE = /failed to fetch|network request failed|networkerror|load failed|fetch failed/i;

export function isUnreachable(error: Error): boolean {
  return error.name === 'AuthRetryableFetchError' || OFFLINE.test(error.message);
}

export function loadErrorMessage(what: string, error: Error): string {
  if (isUnreachable(error)) {
    return "Can't reach Rounds. It runs on the computer at home: check that it's on with Rounds running, and that this phone is on the home Wi-Fi.";
  }
  return `${what} ${error.message}`;
}
