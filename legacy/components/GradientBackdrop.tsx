import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { Dimensions, StyleSheet } from 'react-native';
import { colors } from '../constants/theme';

const { width, height } = Dimensions.get('window');

export default function GradientBackdrop() {
  return (
    <Svg style={styles.svg} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Defs>
        <RadialGradient id="base" cx="50%" cy="30%" r="90%">
          <Stop offset="0%" stopColor="#131A30" />
          <Stop offset="100%" stopColor={colors.background} />
        </RadialGradient>
        <RadialGradient id="blueBlob" cx="20%" cy="15%" r="45%">
          <Stop offset="0%" stopColor={colors.blobBlue} stopOpacity="0.35" />
          <Stop offset="100%" stopColor={colors.blobBlue} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="purpleBlob" cx="85%" cy="70%" r="50%">
          <Stop offset="0%" stopColor={colors.blobPurple} stopOpacity="0.3" />
          <Stop offset="100%" stopColor={colors.blobPurple} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width={width} height={height} fill="url(#base)" />
      <Rect x="0" y="0" width={width} height={height} fill="url(#blueBlob)" />
      <Rect x="0" y="0" width={width} height={height} fill="url(#purpleBlob)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  svg: { position: 'absolute', top: 0, left: 0 },
});