import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GradientBackdrop from '../components/GradientBackdrop';
import GlassContainer from '../components/GlassContainer';
import DateField from '../components/DateField';
import { colors, fonts, spacing, radius } from '../constants/theme';
import { insertLot, getProduitsByLot } from '../db/queries';
import { scheduleForProduit } from '../services/notifications';

const toISO = (d: Date) => d.toISOString().split('T')[0];

export default function AddManualScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [nom, setNom] = useState('');
  const [categorie, setCategorie] = useState('');
  const [quantite, setQuantite] = useState('1');
  const [dateAchat, setDateAchat] = useState(toISO(new Date()));
  const [dlc, setDlc] = useState('');
  const [dureeApresOuverture, setDureeApresOuverture] = useState('3');
  const [estUnReste, setEstUnReste] = useState(false);

  const sauvegarder = () => {
    if (!nom.trim()) return;

    const count = Math.max(1, parseInt(quantite, 10) || 1);
    const lotId = insertLot(
      {
        nom: nom.trim(),
        categorie: categorie.trim() || null,
        quantite: 1,
        date_achat: dateAchat,
        date_peremption_initiale: dlc || null,
        est_ouvert: 0,
        duree_apres_ouverture: parseInt(dureeApresOuverture, 10) || 3,
        date_peremption_effective: dlc || null,
        est_un_reste: estUnReste ? 1 : 0,
      },
      count
    );

    getProduitsByLot(lotId).forEach((u) => scheduleForProduit(u));
    router.back();
  };

  return (
    <View style={styles.container}>
      <GradientBackdrop />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: 140 }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Ajout manuel</Text>
          <Pressable onPress={() => router.back()} style={styles.closeButton}>
            <Ionicons name="close-outline" size={24} color={colors.textSecondary} />
          </Pressable>
        </View>

        <GlassContainer intensity={45} tintColor={colors.surface + 'CC'} style={{ gap: spacing.md }}>
          <View>
            <Text style={styles.label}>Nom du produit</Text>
            <TextInput
              style={styles.input}
              value={nom}
              onChangeText={setNom}
              placeholder="Tomates"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <View>
            <Text style={styles.label}>Catégorie</Text>
            <TextInput
              style={styles.input}
              value={categorie}
              onChangeText={setCategorie}
              placeholder="Plat préparé"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <View style={styles.row}>
            <View style={styles.field}>
              <DateField label="Acheté / Préparé le" value={dateAchat} onChange={setDateAchat} />
            </View>
            <View style={styles.field}>
              <DateField label="DLC" value={dlc} onChange={setDlc} />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.field}>
              <Text style={styles.label}>Quantité</Text>
              <TextInput
                style={styles.input}
                value={quantite}
                onChangeText={setQuantite}
                keyboardType="numeric"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Jours après ouverture</Text>
              <TextInput
                style={styles.input}
                value={dureeApresOuverture}
                onChangeText={setDureeApresOuverture}
                keyboardType="numeric"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          </View>

          <Pressable style={styles.toggleRow} onPress={() => setEstUnReste((v) => !v)}>
            <View style={[styles.checkbox, estUnReste && styles.checkboxChecked]}>
              {estUnReste && <Ionicons name="checkmark" size={14} color={colors.background} />}
            </View>
            <Text style={styles.toggleLabel}>C'est un reste maison</Text>
          </Pressable>
        </GlassContainer>

        <Pressable style={styles.saveButton} onPress={sauvegarder}>
          <Text style={styles.saveButtonText}>Ajouter au frigo</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, gap: spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.textPrimary },
  closeButton: { padding: 4 },
  label: { fontFamily: fonts.body, fontSize: 11, color: colors.textSecondary, marginBottom: 4 },
  input: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  field: { flex: 1 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  toggleLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.textPrimary },
  saveButton: { backgroundColor: colors.accent, paddingVertical: 16, borderRadius: radius.pill, alignItems: 'center' },
  saveButtonText: { fontFamily: fonts.bodyMedium, color: colors.background, fontSize: 15 },
});