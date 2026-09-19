import { useEffect, useRef } from 'react';
import { View, Pressable, StyleSheet, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius } from '../constants/theme';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'fast-food-outline',
  scan: 'camera-outline',
  recipes: 'restaurant-outline',
  settings: 'settings-outline',
};

function TabIcon({
  focused,
  iconName,
  onPress,
}: {
  focused: boolean;
  iconName: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  const anim = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, { toValue: focused ? 1 : 0, useNativeDriver: false, speed: 18, bounciness: 6 }).start();
  }, [focused]);

  const backgroundColor = anim.interpolate({ inputRange: [0, 1], outputRange: ['rgba(124,147,255,0)', colors.accent] });
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <Pressable onPress={onPress} style={styles.tabItem}>
      <Animated.View style={[styles.iconWrap, { backgroundColor, transform: [{ scale }] }]}>
        <Ionicons name={iconName} size={20} color={focused ? colors.background : colors.textSecondary} />
      </Animated.View>
    </Pressable>
  );
}

export default function FloatingTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.wrapper, { bottom: insets.bottom + 12 }]} pointerEvents="box-none">
      <View style={styles.group}>
        <Pressable onPress={() => router.push('/add-manual')} style={styles.addButtonPressable}>
          <BlurView intensity={20} tint="dark" style={styles.addButton}>
            <Ionicons name="add" size={28} color={colors.accent} />
          </BlurView>
        </Pressable>

        <BlurView intensity={20} tint="dark" style={styles.bar}>
          {state.routes
            .filter((route: any) => ICONS[route.name])
            .map((route: any) => {
              const index = state.routes.findIndex((r: any) => r.key === route.key);
              const focused = state.index === index;
              const iconName = ICONS[route.name];

              const onPress = () => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              };

              return <TabIcon key={route.key} focused={focused} iconName={iconName} onPress={onPress} />;
            })}
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  group: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addButtonPressable: { borderRadius: 999 },
  addButton: {
    width: 63,
    height: 63,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: 'rgba(21,26,46,0.55)',
    overflow: 'hidden',
  },
  bar: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    overflow: 'hidden',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    gap: 4,
    backgroundColor: 'rgba(21,26,46,0.55)',
  },
  tabItem: { width: 64, height: 48, alignItems: 'center', justifyContent: 'center' },
  iconWrap: { width: 60, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});