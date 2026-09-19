import { useState, useCallback, useMemo } from 'react';
import { View, FlatList, Text, Image, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getAllProduits, markUnitFini, unmarkUnitFini, Produit } from '../db/queries';
import { scheduleForProduit, cancelForProduit } from '../services/notifications';
import ProductGroupCard from '../components/ProductGroupCard';
import LotDetailModal from '../components/LotDetailModal';
import GradientBackdrop from '../components/GradientBackdrop';
import UndoSnackbar from '../components/UndoSnackbar';
import { colors, fonts, spacing, radius } from '../constants/theme';
import { grouperParLot, ProduitGroupe } from '../utils/grouping';
import { joursRestants } from '../utils/date';

export default function InventaireScreen() {
  const [groupes, setGroupes] = useState<ProduitGroupe[]>([]);
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [filtreCategorie, setFiltreCategorie] = useState<string | null>(null);
  const [snackbarUnit, setSnackbarUnit] = useState<Produit | null>(null);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const chargerProduits = useCallback(() => {
    const produits = getAllProduits();
    const grouped = grouperParLot(produits).sort((a, b) => {
      const ja = Math.min(...a.unites.map((u) => joursRestants(u.date_peremption_effective) ?? 9999));
      const jb = Math.min(...b.unites.map((u) => joursRestants(u.date_peremption_effective) ?? 9999));
      return ja - jb;
    });
    setGroupes(grouped);
  }, []);

  useFocusEffect(useCallback(() => { chargerProduits(); }, [chargerProduits]));

  const categories = useMemo(() => {
    const uniques = new Set(groupes.map((g) => g.categorie).filter((c): c is string => !!c));
    return Array.from(uniques).sort();
  }, [groupes]);

  const groupesFiltres = useMemo(() => {
    if (!filtreCategorie) return groupes;
    return groupes.filter((g) => g.categorie === filtreCategorie);
  }, [groupes, filtreCategorie]);

  const selectedGroupe = groupes.find((g) => g.lot_id === selectedLotId) ?? null;

  const handleConsumeUnit = (u: Produit) => {
    markUnitFini(u.id, 'consomme');
    cancelForProduit(u.id);
    chargerProduits();
    setSnackbarUnit(u);
  };

  const handleUndo = () => {
    if (!snackbarUnit) return;
    unmarkUnitFini(snackbarUnit.id);
    scheduleForProduit(snackbarUnit);
    chargerProduits();
    setSnackbarUnit(null);
  };

  return (
    <View style={styles.container}>
      <GradientBackdrop />
      <FlatList
        data={groupesFiltres}
        keyExtractor={(item) => item.lot_id}
        contentContainerStyle={[styles.listContent, { paddingTop: insets.top + spacing.lg, paddingBottom: 120 }]}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <View style={styles.titleGroup}>
                <Image source={require('../assets/images/logo-mark.png')} style={styles.logo} resizeMode="contain" />
                <Text style={styles.title}>Fridgify</Text>
              </View>
              <View style={styles.headerRight}>
                <Pressable onPress={() => router.push('/history')} style={styles.historyButton}>
                  <Ionicons name="bar-chart-outline" size={20} color={colors.textPrimary} />
                </Pressable>
              </View>
            </View>
            {categories.length > 0 && (
              <View style={styles.chipsRow}>
                <Pressable style={[styles.chip, filtreCategorie === null && styles.chipActive]} onPress={() => setFiltreCategorie(null)}>
                  <Text style={[styles.chipText, filtreCategorie === null && styles.chipTextActive]}>Tous</Text>
                </Pressable>
                {categories.map((cat) => (
                  <Pressable key={cat} style={[styles.chip, filtreCategorie === cat && styles.chipActive]} onPress={() => setFiltreCategorie(filtreCategorie === cat ? null : cat)}>
                    <Text style={[styles.chipText, filtreCategorie === cat && styles.chipTextActive]}>{cat}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        }
        renderItem={({ item }) => <ProductGroupCard groupe={item} onPress={() => setSelectedLotId(item.lot_id)} />}
        ListEmptyComponent={<Text style={styles.empty}>Frigo vide pour l'instant.</Text>}
      />

      <LotDetailModal
        groupe={selectedGroupe}
        visible={selectedGroupe !== null}
        onClose={() => setSelectedLotId(null)}
        onRefresh={chargerProduits}
        onConsumeUnit={handleConsumeUnit}
      />

      <UndoSnackbar
        visible={snackbarUnit !== null}
        message={`${snackbarUnit?.nom ?? ''} marqué consommé`}
        onUndo={handleUndo}
        onTimeout={() => setSnackbarUnit(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: 16, gap: 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  titleGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  logo: { width: 50, height: 50 },
  title: { fontFamily: fonts.display, fontSize: 25, color: colors.textPrimary },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  subtitle: { fontFamily: fonts.body, fontSize: 18, color: colors.textSecondary },
  historyButton: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.surfaceBorder },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.lg },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.surfaceBorder, backgroundColor: colors.surface + '80' },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.textSecondary },
  chipTextActive: { color: colors.background },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textSecondary, fontFamily: fonts.body },
});