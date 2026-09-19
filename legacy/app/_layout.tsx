import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold } from '@expo-google-fonts/space-grotesk';
import { Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import * as SplashScreen from 'expo-splash-screen';
import { initSchema } from '../db/schema';
import { initSettingsSchema } from '../db/settings';
import { notificationsEnabled, requestNotificationPermissions } from '../services/notifications';
import { colors } from '../constants/theme';
import FloatingTabBar from '../components/FloatingTabBar';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    IBMPlexMono_500Medium,
  });

  useEffect(() => {
    initSchema();
    initSettingsSchema();
    if (notificationsEnabled()) {
      requestNotificationPermissions();
    }
  }, []);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  useEffect(() => {
    initSchema();
    initSettingsSchema();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <>
      <StatusBar style="light" />
      <Tabs
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
      >
        <Tabs.Screen name="index" options={{ title: 'Inventaire' }} />
        <Tabs.Screen name="scan" options={{ title: 'Scanner' }} />
        <Tabs.Screen name="recipes" options={{ title: 'Recettes' }} />
        <Tabs.Screen name="settings" options={{ title: 'Réglages' }} />
        <Tabs.Screen name="add-manual" options={{ href: null }} />
        <Tabs.Screen name="history" options={{ href: null }} />
      </Tabs>
    </>
  );
}