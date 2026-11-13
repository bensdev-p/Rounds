import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/** Whether the on-screen keyboard is up (the ladder collapses to a strip). */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') {
      // Mobile browsers shrink the visual viewport when the keyboard opens.
      const viewport = typeof window === 'undefined' ? undefined : window.visualViewport;
      if (!viewport) return;
      const update = () => setVisible(window.innerHeight - viewport.height > 150);
      viewport.addEventListener('resize', update);
      return () => viewport.removeEventListener('resize', update);
    }
    const show = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}
