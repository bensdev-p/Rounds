import { answerTimeLimit, type PersonaId, type Profile, type VoiceSpeed } from '@rounds/shared';
import { getProfile, saveProfile } from '@rounds/shared/api';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ErrorView, Loading } from '@/components/StatusView';
import { Onboarding } from '@/features/onboarding/Onboarding';
import { useClient } from './auth';
import { loadErrorMessage } from './errors';
import { useAsync } from './useAsync';

interface ProfileValue {
  profile: Profile;
  /** Applies at once; saved in the background. */
  update: (patch: Partial<Profile>) => Promise<void>;
}

const ProfileContext = createContext<ProfileValue | null>(null);

/**
 * Loads the student's profile. Without one (a new student, or one from before
 * profiles existed) the app shows onboarding (wireframe 01) instead.
 */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const client = useClient();
  const loaded = useAsync(() => getProfile(client), 'profile');
  const [profile, setProfile] = useState<Profile | null>(null);

  const current = profile ?? (loaded.status === 'ready' ? loaded.data : null);

  const update = useCallback(
    async (patch: Partial<Profile>) => {
      if (!current) return;
      const next = { ...current, ...patch };
      setProfile(next);
      try {
        await saveProfile(client, next);
      } catch (e) {
        // Keep the choice on screen; it is saved again with the next change.
        console.warn('[rounds] profile not saved', e);
      }
    },
    [client, current],
  );

  const value = useMemo(() => (current ? { profile: current, update } : null), [current, update]);

  if (loaded.status === 'loading') return <Loading label="Loading your rounds" />;
  if (loaded.status === 'error') {
    return (
      <ErrorView
        message={loadErrorMessage("Couldn't load your setup.", loaded.error)}
        onRetry={loaded.reload}
      />
    );
  }
  if (!value) {
    return (
      <Onboarding
        onDone={async (p) => {
          setProfile(await saveProfile(client, p));
        }}
      />
    );
  }
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileValue {
  const value = useContext(ProfileContext);
  if (!value) throw new Error('useProfile must be used inside <ProfileProvider>');
  return value;
}

/** The persona picker's choice, kept in the profile so it follows the student. */
export function usePersona(): [PersonaId, (next: PersonaId) => void] {
  const { profile, update } = useProfile();
  return [profile.persona, (persona) => void update({ persona })];
}

/** Sessions per day that finish rounds (Settings → Daily goal). */
export function useRoundsGoal(): [number, (next: number) => void] {
  const { profile, update } = useProfile();
  return [profile.daily_goal, (daily_goal) => void update({ daily_goal })];
}

/** The `slow` time limit for a session with this persona (Settings → Answer timeout). */
export function useTimeLimit(persona: PersonaId): number | null {
  const { profile } = useProfile();
  return answerTimeLimit(persona, profile.answer_timeout);
}

/** How fast the attending speaks (Settings → Voice → Attending voice speed). */
export function useVoiceSpeed(): [VoiceSpeed, (next: VoiceSpeed) => void] {
  const { profile, update } = useProfile();
  return [profile.voice_speed, (voice_speed) => void update({ voice_speed })];
}
