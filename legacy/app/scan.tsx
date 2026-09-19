import { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GradientBackdrop from '../components/GradientBackdrop';
import GlassContainer from '../components/GlassContainer';
import DateField from '../components/DateField';
import { colors, fonts, spacing, radius } from '../constants/theme';
import { scanReceipt, ProduitDetecte } from '../services/llm';
import { insertLot, getProduitsByLot } from '../db/queries';
import { scheduleForProduit } from '../services/notifications';

type ProduitAValider = ProduitDetecte & {
  dateAchat: string;
  dlc: string;
  dureeApresOuverture: string;
  quantiteTexte: string;
};

const toISO = (d: Date) => d.toISOString().split('T')[0];

export default function ScanScreen() {
  const [loading, setLoading] = useState(false);
  const [produits, setProduits] = useState<ProduitAValider[] | null>(null);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const prendrePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission requise', "L'accès à la caméra est nécessaire pour scanner un ticket.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 });
    if (result.canceled || !result.assets[0].base64) return;

    setLoading(true);
    setProduits(null);

    try {
      const detectes = await scanReceipt(result.assets[0].base64);
      const aujourdHui = toISO(new Date());
      setProduits(
        detectes.map((p) => ({
          ...p,
          dateAchat: aujourdHui,
          dlc: '',
          dureeApresOuverture: '3',
          quantiteTexte: String(p.quantite || 1),
        }))
      );
    } catch (err: any) {
      Alert.alert('Erreur', err.message ?? 'Le scan a échoué.');
    } finally {
      setLoading(false);
    }
  };

  const updateProduit = (index: number, champ: keyof ProduitAValider, valeur: string) => {
    if (!produits) return;
    const copie = [...produits];
    copie[index] = { ...copie[index], [champ]: valeur };
    setProduits(copie);
  };

  const supprimerLigne = (index: number) => {
    if (!produits) return;
    setProduits(produits.filter((_, i) => i !== index));
  };

  const validerTout = () => {
    if (!produits || produits.length === 0) return;

    produits.forEach((p) => {
      const count = Math.max(1, parseInt(p.quantiteTexte, 10) || 1);
      const lotId = insertLot(
        {
          nom: p.nom,
          categorie: p.categorie,
          quantite: 1,
          date_achat: p.dateAchat,
          date_peremption_initiale: p.dlc || null,
          est_ouvert: 0,
          duree_apres_ouverture: parseInt(p.dureeApresOuverture, 10) || 3,
          date_peremption_effective: p.dlc || null,
          est_un_reste: 0,
        },
        count
      );
      getProduitsByLot(lotId).forEach((u) => scheduleForProduit(u));
    });

    setProduits(null);
    router.push('/');
  };

  return (
    <View style={styles.container}>
      <GradientBackdrop />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: 140 }]}>
        <Text style={styles.title}>Scanner</Text>

        {!produits && (
          <Pressable style={styles.captureButton} onPress={prendrePhoto} disabled={loading}>
            <Text style={styles.captureButtonText}>{loading ? 'Analyse en cours…' : 'Prendre une photo du ticket'}</Text>
          </Pressable>
        )}

        {loading && <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.lg }} />}

        {produits && produits.length > 0 && (
          <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
            {produits.map((p, index) => (
              <GlassContainer key={index} intensity={45} tintColor={colors.surface + 'CC'}>
                <TextInput
                  style={styles.inputNom}
                  value={p.nom}
                  onChangeText={(v) => updateProduit(index, 'nom', v)}
                  placeholderTextColor={colors.textSecondary}
                />
                <Text style={styles.categorieLabel}>{p.categorie}</Text>

                <View style={styles.row}>
                  <View style={styles.field}>
                    <DateField label="DLC" value={p.dlc} onChange={(v) => updateProduit(index, 'dlc', v)} />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Quantité</Text>
                    <TextInput
                      style={styles.input}
                      value={p.quantiteTexte}
                      onChangeText={(v) => updateProduit(index, 'quantiteTexte', v)}
                      keyboardType="numeric"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Jours après ouverture</Text>
                  <TextInput
                    style={styles.input}
                    value={p.dureeApresOuverture}
                    onChangeText={(v) => updateProduit(index, 'dureeApresOuverture', v)}
                    keyboardType="numeric"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>

                <Pressable onPress={() => supprimerLigne(index)}>
                  <Text style={styles.retirer}>Retirer ce produit</Text>
                </Pressable>
              </GlassContainer>
            ))}

            <Pressable style={styles.validerButton} onPress={validerTout}>
              <Text style={styles.validerButtonText}>Ajouter au frigo ({produits.length})</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16 },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.textPrimary, marginBottom: spacing.lg },
  captureButton: { backgroundColor: colors.accent, paddingVertical: 16, borderRadius: radius.pill, alignItems: 'center' },
  captureButtonText: { fontFamily: fonts.bodyMedium, color: colors.background, fontSize: 15 },
  inputNom: { fontFamily: fonts.display, fontSize: 16, color: colors.textPrimary, paddingVertical: 4 },
  categorieLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  field: { flex: 1, marginBottom: spacing.sm },
  fieldLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.textSecondary, marginBottom: 4 },
  input: { fontFamily: fonts.mono, fontSize: 13, color: colors.textPrimary, borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: 10, paddingHorizontal: spacing.sm, paddingVertical: 8 },
  retirer: { fontFamily: fonts.body, fontSize: 12, color: colors.critical, marginTop: spacing.sm },
  validerButton: { backgroundColor: colors.accent, paddingVertical: 16, borderRadius: radius.pill, alignItems: 'center' },
  validerButtonText: { fontFamily: fonts.bodyMedium, color: colors.background, fontSize: 15 },
});