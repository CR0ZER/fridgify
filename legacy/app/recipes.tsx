import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GradientBackdrop from '../components/GradientBackdrop';
import GlassContainer from '../components/GlassContainer';
import { colors, fonts, spacing, radius } from '../constants/theme';
import { getAllProduits } from '../db/queries';
import { generateRecipes, RecetteGeneree } from '../services/llm';

function joursRestants(dateEffective: string | null): number | null {
  if (!dateEffective) return null;
  const aujourdHui = new Date();
  aujourdHui.setHours(0, 0, 0, 0);
  const dateExp = new Date(dateEffective);
  const diffMs = dateExp.getTime() - aujourdHui.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export default function RecipesScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [recettes, setRecettes] = useState<RecetteGeneree[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [envie, setEnvie] = useState('');

  const clearRecettes = () => {
    setRecettes(null);
    setError(null);
  };

  const genererRecettes = async () => {
    const produits = getAllProduits();

    if (produits.length === 0) {
      setError('Votre frigo est vide, rien à proposer pour le moment.');
      return;
    }

    const triesParUrgence = [...produits].sort((a, b) => {
      const ja = joursRestants(a.date_peremption_effective) ?? 9999;
      const jb = joursRestants(b.date_peremption_effective) ?? 9999;
      return ja - jb;
    });

    const noms = triesParUrgence.map((p) => p.nom);

    setLoading(true);
    setError(null);
    setRecettes(null);

    try {
      const result = await generateRecipes(noms, envie);
      setRecettes(result);
    } catch (err: any) {
      setError(err.message ?? 'La génération a échoué.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <GradientBackdrop />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: 140 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Recettes</Text>

          {recettes && !loading && (
            <Pressable
              style={styles.clearButton}
              onPress={clearRecettes}
              accessibilityLabel="Effacer les recettes"
            >
              <Ionicons name="trash-outline" size={22} color={colors.critical} />
            </Pressable>
          )}
        </View>

        {!recettes && !loading && (
          <View style={{ gap: spacing.md }}>
            <View>
              <Text style={styles.label}>Une envie particulière ? (facultatif)</Text>
              <TextInput
                style={styles.input}
                value={envie}
                onChangeText={setEnvie}
                placeholder="Ex : quelque chose de léger, un plat en sauce…"
                placeholderTextColor={colors.textSecondary}
                multiline
              />
            </View>
            <Pressable style={styles.inspirationButton} onPress={genererRecettes}>
              <Text style={styles.inspirationButtonText}>Générer des recettes</Text>
            </Pressable>
          </View>
        )}

        {loading && <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.lg }} />}

        {error && <Text style={styles.error}>{error}</Text>}

        {recettes && recettes.length > 0 && (
          <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
            {recettes.map((recette, index) => (
              <GlassContainer key={index} intensity={50} tintColor={colors.surface + 'CC'}>
                <Text style={styles.recetteTitle}>{recette.titre}</Text>

                <Text style={styles.sectionLabel}>Ingrédients utilisés</Text>
                <View style={styles.ingredientsList}>
                  {recette.ingredients_utilises.map((ing, i) => (
                    <View key={i} style={styles.ingredientChip}>
                      <Text style={styles.ingredientText}>{ing}</Text>
                    </View>
                  ))}
                </View>

                <Text style={styles.sectionLabel}>Préparation</Text>
                {recette.etapes.map((etape, i) => (
                  <View key={i} style={styles.etapeRow}>
                    <Text style={styles.etapeNumero}>{i + 1}</Text>
                    <Text style={styles.etapeText}>{etape}</Text>
                  </View>
                ))}
              </GlassContainer>
            ))}

            <Pressable style={styles.retryButton} onPress={genererRecettes}>
              <Text style={styles.retryButtonText}>D'autres idées</Text>
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: fonts.display, fontSize: 25, color: colors.textPrimary, marginBottom: spacing.md },
  clearButton: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radius.pill,
  },
  clearButtonText: { fontFamily: fonts.bodyMedium, color: colors.textSecondary, fontSize: 13 },
  label: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginBottom: spacing.xs },
  input: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    minHeight: 48,
  },
  inspirationButton: { backgroundColor: colors.accent, paddingVertical: 16, borderRadius: radius.pill, alignItems: 'center' },
  inspirationButtonText: { fontFamily: fonts.bodyMedium, color: colors.background, fontSize: 15 },
  error: { fontFamily: fonts.body, color: colors.critical, marginTop: spacing.lg, textAlign: 'center' },
  recetteTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.textPrimary, marginBottom: spacing.md },
  sectionLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.sm, textTransform: 'uppercase' },
  ingredientsList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  ingredientChip: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.surfaceBorder, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.pill },
  ingredientText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textPrimary },
  etapeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm, alignItems: 'flex-start' },
  etapeNumero: { fontFamily: fonts.mono, fontSize: 13, color: colors.accent, width: 20 },
  etapeText: { fontFamily: fonts.body, fontSize: 13, color: colors.textPrimary, flex: 1, lineHeight: 19 },
  retryButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.surfaceBorder, paddingVertical: 14, borderRadius: radius.pill, alignItems: 'center' },
  retryButtonText: { fontFamily: fonts.bodyMedium, color: colors.textSecondary, fontSize: 14 },
});