import { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GradientBackdrop from '../components/GradientBackdrop';
import GlassContainer from '../components/GlassContainer';
import PromptEditorModal from '../components/PromptEditorModal';
import { colors, fonts, spacing, radius } from '../constants/theme';
import { getProvider, setProvider, LLMProvider } from '../services/llm/provider';
import { DEFAULT_SCAN_PROMPT, DEFAULT_RECIPE_PROMPT } from '../services/llm/gemini';
import { getSetting, setSetting, deleteSetting } from '../db/settings';
import { db } from '../db/client';
import { Switch } from 'react-native';
import { notificationsEnabled, setNotificationsEnabled, requestNotificationPermissions, rescheduleAll } from '../services/notifications';
import { getAllProduits } from '../db/queries';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [provider, setProviderState] = useState<LLMProvider>(getProvider());
  const [editingPrompt, setEditingPrompt] = useState<'scan' | 'recipes' | null>(null);

  const choisirProvider = (p: LLMProvider) => {
    setProvider(p);
    setProviderState(p);
  };

  const reinitialiserDonnees = () => {
    Alert.alert('Réinitialiser', 'Ceci supprime tous les produits enregistrés. Confirmer ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer tout',
        style: 'destructive',
        onPress: () => {
          db.execSync('DELETE FROM inventaire_frigo;');
          Alert.alert('Fait', 'Inventaire vidé.');
        },
      },
    ]);
  };

  const promptKey = editingPrompt === 'scan' ? 'prompt_scan' : 'prompt_recipes';
  const promptDefault = editingPrompt === 'scan' ? DEFAULT_SCAN_PROMPT : DEFAULT_RECIPE_PROMPT;
  const promptTitle = editingPrompt === 'scan' ? 'Prompt — Scan de ticket' : 'Prompt — Génération de recettes';
  const promptCurrent = editingPrompt ? getSetting(promptKey) ?? promptDefault : '';

  const [notifOn, setNotifOn] = useState(notificationsEnabled());

  const toggleNotifications = async (value: boolean) => {
    if (value) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert('Permission refusée', "Activez les notifications pour cette app dans les réglages iOS.");
        return;
      }
    }
    setNotificationsEnabled(value);
    setNotifOn(value);
    await rescheduleAll(getAllProduits());
  };

  return (
    <View style={styles.container}>
      <GradientBackdrop />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: 140 }]}>
        <Text style={styles.title}>Réglages</Text>

        <GlassContainer intensity={45} tintColor={colors.surface + 'CC'} style={{ gap: spacing.sm }}>
          <Text style={styles.sectionLabel}>Fournisseur IA</Text>
          <View style={styles.providerRow}>
            <Pressable style={[styles.providerOption, provider === 'gemini' && styles.providerOptionActive]} onPress={() => choisirProvider('gemini')}>
              <Text style={[styles.providerText, provider === 'gemini' && styles.providerTextActive]}>Gemini</Text>
            </Pressable>
            <Pressable style={[styles.providerOption, provider === 'groq' && styles.providerOptionActive]} onPress={() => choisirProvider('groq')}>
              <Text style={[styles.providerText, provider === 'groq' && styles.providerTextActive]}>Groq</Text>
            </Pressable>
          </View>
          {provider === 'groq' && <Text style={styles.warning}>Groq n'est pas encore implémenté pour le scan et les recettes.</Text>}
        </GlassContainer>

        <GlassContainer intensity={45} tintColor={colors.surface + 'CC'} style={{ marginTop: spacing.lg }}>
          <View style={styles.switchRow}>
            <Text style={styles.sectionLabel}>Notifications de péremption</Text>
            <Switch
              value={notifOn}
              onValueChange={toggleNotifications}
              trackColor={{ false: colors.surfaceBorder, true: colors.accent }}
              thumbColor={colors.textPrimary}
            />
          </View>
        </GlassContainer>

        <GlassContainer intensity={45} tintColor={colors.surface + 'CC'} style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <Text style={styles.sectionLabel}>Prompts personnalisés</Text>
          <Pressable style={styles.editRow} onPress={() => setEditingPrompt('scan')}>
            <Text style={styles.editRowText}>Modifier le prompt de scan</Text>
          </Pressable>
          <Pressable style={styles.editRow} onPress={() => setEditingPrompt('recipes')}>
            <Text style={styles.editRowText}>Modifier le prompt de recettes</Text>
          </Pressable>
          <Text style={styles.hint}>
            Pour le prompt de recettes, conservez le jeton {'{{INGREDIENTS}}'} quelque part dans le texte — c'est là que votre liste d'ingrédients réelle sera insérée.
          </Text>
        </GlassContainer>

        <GlassContainer intensity={45} tintColor={colors.surface + 'CC'} style={{ marginTop: spacing.lg }}>
          <Text style={styles.sectionLabel}>Données</Text>
          <Pressable style={styles.dangerButton} onPress={reinitialiserDonnees}>
            <Text style={styles.dangerButtonText}>Vider le frigo</Text>
          </Pressable>
        </GlassContainer>
      </ScrollView>

      <PromptEditorModal
        visible={editingPrompt !== null}
        title={promptTitle}
        currentValue={promptCurrent}
        defaultValue={promptDefault}
        onClose={() => setEditingPrompt(null)}
        onSave={(value) => {
          setSetting(promptKey, value);
          setEditingPrompt(null);
        }}
        onReset={() => {
          deleteSetting(promptKey);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16 },
  title: { fontFamily: fonts.display, fontSize: 25, color: colors.textPrimary, marginBottom: spacing.md },
  sectionLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm },
  providerRow: { flexDirection: 'row', gap: spacing.sm },
  providerOption: { flex: 1, paddingVertical: 12, borderRadius: radius.button, borderWidth: 1, borderColor: colors.surfaceBorder, alignItems: 'center' },
  providerOptionActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  providerText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textSecondary },
  providerTextActive: { color: colors.background },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  warning: { fontFamily: fonts.body, fontSize: 12, color: colors.warning, marginTop: spacing.xs },
  editRow: { borderWidth: 1, borderColor: colors.surfaceBorder, paddingVertical: 12, borderRadius: radius.button, alignItems: 'center' },
  editRowText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textPrimary },
  hint: { fontFamily: fonts.body, fontSize: 11, color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 16 },
  dangerButton: { borderWidth: 1, borderColor: colors.critical, paddingVertical: 12, borderRadius: radius.button, alignItems: 'center' },
  dangerButtonText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.critical },
});