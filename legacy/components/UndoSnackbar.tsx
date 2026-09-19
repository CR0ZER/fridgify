import { useEffect, useRef } from 'react';
import { Animated, View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, spacing, radius } from '../constants/theme';

type Props = {
  visible: boolean;
  message: string;
  onUndo: () => void;
  onTimeout: () => void;
  durationMs?: number;
};

export default function UndoSnackbar({ visible, message, onUndo, onTimeout, durationMs = 4000 }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      timerRef.current = setTimeout(() => {
        onTimeout();
      }, durationMs);
    } else {
      Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.wrapper, { opacity, bottom: insets.bottom + 100 }]} pointerEvents="box-none">
      <View style={styles.bar}>
        <Text style={styles.text}>{message}</Text>
        <Pressable
          onPress={() => {
            if (timerRef.current) clearTimeout(timerRef.current);
            onUndo();
          }}
        >
          <Text style={styles.undoText}>Annuler</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', left: 24, right: 24, alignItems: 'center' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  text: { fontFamily: fonts.body, fontSize: 13, color: colors.textPrimary, flexShrink: 1 },
  undoText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.accent },
});