import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import GradientBackdrop from '../components/GradientBackdrop';
import GlassContainer from '../components/GlassContainer';
import { colors, fonts, spacing, radius } from '../constants/theme';
import { getStats, getTopJete, getRecentMouvements, Stats, TopJete, MouvementRecent } from '../db/queries';
import { formatDateAffichage } from '../utils/date';

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<Stats>({ totalConsomme: 0, totalJete: 0 });
  const [topJete, setTopJete] = useState<TopJete[]>([]);
  const [recents, setRecents] = useState<MouvementRecent[]>([]);

  useFocusEffect(
    useCallback(() => {
      setStats(getStats());
      setTopJete(getTopJete());
      setRecents(getRecentMouvements());
    }, [])
  );

  const total = stats.totalConsomme + stats.totalJete;
  const tauxJete = total > 0 ? Math.round((stats.totalJete / total) * 100) : 0;
  const ratioConsomme = total > 0 ? stats.totalConsomme / total : 0;

  return (
    <View style={styles.container}>
      <GradientBackdrop />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: 140 }]}>
        <Text style={styles.title}>Historique</Text>

        {total === 0 ? (
          <Text style={styles.empty}>Aucun produit terminé pour l'instant.</Text>
        ) : (
          <>
            <GlassContainer intensity={45} tintColor={colors.surface + 'CC'}>
              <View style={styles.bigNumberRow}>
                <Text style={styles.bigPercent}>{100 - tauxJete}%</Text>
                <Text style={styles.bigPercentLabel}>consommé plutôt que jeté</Text>
              </View>

              <View style={styles.barTrack}>
                <View style={[styles.barFillConsomme, { flex: ratioConsomme || 0.001 }]} />
                <View style={[styles.barFillJete, { flex: 1 - ratioConsomme || 0.001 }]} />
              </View>

              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.fresh }]} />
                  <Text style={styles.legendText}>{stats.totalConsomme} consommés</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.critical }]} />
                  <Text style={styles.legendText}>{stats.totalJete} jetés</Text>
                </View>
              </View>
            </GlassContainer>

            {topJete.length > 0 && (
              <GlassContainer intensity={45} tintColor={colors.surface + 'CC'} style={{ marginTop: spacing.md }}>
                <Text style={styles.sectionLabel}>Souvent jetés</Text>
                {topJete.map((item, i) => (
                  <View key={i} style={styles.topRow}>
                    <Text style={styles.topNom}>{item.nom}</Text>
                    <Text style={styles.topCount}>{item.count}×</Text>
                  </View>
                ))}
              </GlassContainer>
            )}

            {recents.length > 0 && (
              <GlassContainer intensity={45} tintColor={colors.surface + 'CC'} style={{ marginTop: spacing.md }}>
                <Text style={styles.sectionLabel}>Derniers mouvements</Text>
                {recents.map((item) => (
                  <View key={item.id} style={styles.mouvementRow}>
                    <View
                      style={[
                        styles.mouvementBadge,
                        { backgroundColor: item.statut_fin === 'consomme' ? colors.fresh + '22' : colors.critical + '22' },
                      ]}
                    >
                      <Text style={{ color: item.statut_fin === 'consomme' ? colors.fresh : colors.critical, fontSize: 11, fontFamily: fonts.bodyMedium }}>
                        {item.statut_fin === 'consomme' ? 'Consommé' : 'Jeté'}
                      </Text>
                    </View>
                    <Text style={styles.mouvementNom} numberOfLines={1}>{item.nom}</Text>
                    <Text style={styles.mouvementDate}>{formatDateAffichage(item.date_fin)}</Text>
                  </View>
                ))}
              </GlassContainer>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16 },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.textPrimary, marginBottom: spacing.lg },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textSecondary, fontFamily: fonts.body },

  bigNumberRow: { alignItems: 'center', marginBottom: spacing.md },
  bigPercent: { fontFamily: fonts.mono, fontSize: 44, color: colors.textPrimary },
  bigPercentLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 2 },

  barTrack: { flexDirection: 'row', height: 10, borderRadius: 999, overflow: 'hidden', backgroundColor: colors.surfaceBorder },
  barFillConsomme: { backgroundColor: colors.fresh },
  barFillJete: { backgroundColor: colors.critical },

  legendRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },

  sectionLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs, borderTopWidth: 1, borderTopColor: colors.surfaceBorder },
  topNom: { fontFamily: fonts.body, fontSize: 13, color: colors.textPrimary },
  topCount: { fontFamily: fonts.mono, fontSize: 13, color: colors.critical },

  mouvementRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs, borderTopWidth: 1, borderTopColor: colors.surfaceBorder },
  mouvementBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  mouvementNom: { fontFamily: fonts.body, fontSize: 13, color: colors.textPrimary, flex: 1 },
  mouvementDate: { fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary },
});