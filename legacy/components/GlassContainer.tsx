import { StyleSheet, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, radius } from '../constants/theme';

type Props = {
  children: React.ReactNode;
  intensity?: number;
  tintColor?: string;
  style?: ViewStyle;
};

export default function GlassContainer({ children, intensity = 45, tintColor, style }: Props) {
  return (
    <BlurView
      intensity={intensity}
      tint="dark"
      style={[
        styles.container,
        tintColor ? { backgroundColor: tintColor } : null,
        style,
      ]}
    >
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    overflow: 'hidden',
    padding: 16,
  },
});