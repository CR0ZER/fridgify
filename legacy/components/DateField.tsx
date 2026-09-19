import { View, Text, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, fonts } from '../constants/theme';

type Props = {
  label: string;
  value: string; // format ISO YYYY-MM-DD, peut être vide
  onChange: (isoDate: string) => void;
};

export default function DateField({ label, value, onChange }: Props) {
  const dateValue = value ? new Date(value) : new Date();

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <DateTimePicker
        mode="date"
        display="compact"
        value={dateValue}
        themeVariant="dark"
        accentColor={colors.accent}
        onValueChange={(_, selectedDate) => {
          if (selectedDate) {
            onChange(selectedDate.toISOString().split('T')[0]);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.body, fontSize: 11, color: colors.textSecondary, marginBottom: 4 },
});