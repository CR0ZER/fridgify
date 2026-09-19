import { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import GlassContainer from './GlassContainer';
import { colors, fonts, spacing, radius } from '../constants/theme';

type Props = {
  visible: boolean;
  title: string;
  currentValue: string;
  defaultValue: string;
  onClose: () => void;
  onSave: (value: string) => void;
  onReset: () => void;
};

export default function PromptEditorModal({ visible, title, currentValue, defaultValue, onClose, onSave, onReset }: Props) {
  const [text, setText] = useState(currentValue);

  useEffect(() => {
    setText(currentValue);
  }, [currentValue, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()} style={styles.wrapper}>
          <GlassContainer intensity={60} tintColor={colors.surface + 'F0'} style={styles.card}>
            <Text style={styles.title}>{title}</Text>
            <ScrollView style={styles.scrollArea}>
              <TextInput
                style={styles.input}
                value={text}
                onChangeText={setText}
                multiline
                textAlignVertical="top"
                placeholderTextColor={colors.textSecondary}
              />
            </ScrollView>

            <View style={styles.actions}>
              <Pressable style={styles.saveButton} onPress={() => onSave(text)}>
                <Text style={styles.saveButtonText}>Enregistrer</Text>
              </Pressable>
              <Pressable
                style={styles.resetButton}
                onPress={() => {
                  setText(defaultValue);
                  onReset();
                }}
              >
                <Text style={styles.resetButtonText}>Réinitialiser au défaut</Text>
              </Pressable>
            </View>
          </GlassContainer>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(3,5,12,0.7)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  wrapper: { width: '100%', maxWidth: 400, maxHeight: '80%' },
  card: {},
  title: { fontFamily: fonts.display, fontSize: 17, color: colors.textPrimary, marginBottom: spacing.sm },
  scrollArea: { maxHeight: 320, marginBottom: spacing.md },
  input: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textPrimary,
    lineHeight: 18,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 10,
    padding: spacing.sm,
    minHeight: 280,
  },
  actions: { gap: spacing.sm },
  saveButton: { backgroundColor: colors.accent, paddingVertical: 12, borderRadius: radius.pill, alignItems: 'center' },
  saveButtonText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.background },
  resetButton: { borderWidth: 1, borderColor: colors.surfaceBorder, paddingVertical: 12, borderRadius: radius.pill, alignItems: 'center' },
  resetButtonText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textSecondary },
});