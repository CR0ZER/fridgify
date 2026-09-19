export const colors = {
  background: '#0A0E1A',
  blobBlue: '#3E63FF',
  blobPurple: '#8B5CF6',
  surface: '#151A2E',
  surfaceBorder: 'rgba(255, 255, 255, 0.13)',
  textPrimary: '#F2F5FA',
  textSecondary: '#8791A8',
  fresh: '#35D399',
  warning: '#F5B84C',
  critical: '#F2726B',
  accent: '#7C93FF',
};

export const fonts = {
  display: 'SpaceGrotesk_600SemiBold',
  displayMedium: 'SpaceGrotesk_500Medium',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  mono: 'IBMPlexMono_500Medium',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const radius = { card: 24, button: 14, pill: 999 };

export function urgenceLevel(jours: number | null): 'fresh' | 'warning' | 'critical' {
  if (jours === null) return 'fresh';
  if (jours <= 1) return 'critical';
  if (jours <= 3) return 'warning';
  return 'fresh';
}

export function couleurUrgence(level: 'fresh' | 'warning' | 'critical'): string {
  return colors[level];
}