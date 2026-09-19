import { View, Text, Pressable, StyleSheet } from 'react-native';
import GlassContainer from './GlassContainer';
import StatusDot from './StatusDot';
import { colors, fonts, spacing, radius, urgenceLevel, couleurUrgence } from '../constants/theme';
import { ProduitGroupe } from '../utils/grouping';
import { joursRestants, formatDateAffichage } from '../utils/date';

type Props = {
  groupe: ProduitGroupe;
  onPress: () => void;
};

export default function ProductGroupCard({ groupe, onPress }: Props) {
  const uniteLaPlusUrgente = [...groupe.unites].sort((a, b) => {
    const ja = joursRestants(a.date_peremption_effective) ?? 9999;
    const jb = joursRestants(b.date_peremption_effective) ?? 9999;
    return ja - jb;
  })[0];

  const jours = joursRestants(uniteLaPlusUrgente.date_peremption_effective);
  const level = urgenceLevel(jours);
  const statusColor = couleurUrgence(level);

  const labelJours =
    jours === null
      ? 'Date inconnue'
      : jours < 0
      ? `Périmé depuis ${Math.abs(jours)}j`
      : jours === 0
      ? "Périme aujourd'hui"
      : `J-${jours}`;

  return (
    <Pressable onPress={onPress} style={[styles.shadowWrapper, { shadowColor: statusColor }]}>
      <GlassContainer intensity={45} tintColor={colors.surface + 'CC'} style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.nom}>{groupe.nom}</Text>
          <View style={styles.headerRight}>
            {groupe.unites.length > 1 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>x{groupe.unites.length}</Text>
              </View>
            )}
            <StatusDot color={statusColor} />
          </View>
        </View>
        <Text style={styles.dateAchat}>Acheté le {formatDateAffichage(uniteLaPlusUrgente.date_achat)}</Text>
        <Text style={[styles.compteur, { color: statusColor }]}>{labelJours}</Text>
      </GlassContainer>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {},
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  nom: { fontFamily: fonts.display, fontSize: 17, color: colors.textPrimary, flexShrink: 1, marginRight: spacing.sm },
  countBadge: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.surfaceBorder, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, marginRight: spacing.sm },
  countBadgeText: { fontFamily: fonts.mono, fontSize: 12, color: colors.textSecondary },
  dateAchat: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  compteur: { fontFamily: fonts.mono, fontSize: 20, marginTop: spacing.sm },
  shadowWrapper: { marginBottom: spacing.lg, borderRadius: radius.card, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.2, shadowRadius: 10 },
});