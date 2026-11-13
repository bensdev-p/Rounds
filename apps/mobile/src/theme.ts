import { useColorScheme } from 'react-native';

const light = {
  background: '#FFFFFF',
  surface: '#F3F4F6',
  text: '#111827',
  muted: '#4B5563',
  border: '#D1D5DB',
  primary: '#1D4ED8',
  onPrimary: '#FFFFFF',
  success: '#047857',
  danger: '#B91C1C',
  warning: '#92400E',
};

const dark: typeof light = {
  background: '#0B0F17',
  surface: '#161B26',
  text: '#F3F4F6',
  muted: '#9CA3AF',
  border: '#2D3442',
  primary: '#60A5FA',
  onPrimary: '#0B0F17',
  success: '#34D399',
  danger: '#F87171',
  warning: '#FBBF24',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
