import { useState } from 'react';
import { Modal, View, Text, Pressable, TextInput, Alert, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassContainer from './GlassContainer';
import StatusDot from './StatusDot';
import DateField from './DateField';
import { colors, fonts, spacing, radius, urgenceLevel, couleurUrgence } from '../constants/theme';
import { Produit, updateProduit, toggleOuvert, markUnitFini, deleteProduit } from '../db/queries';
import { scheduleForProduit, cancelForProduit } from '../services/notifications';
import { ProduitGroupe } from '../utils/grouping';
import { joursRestants, formatDateAffichage } from '../utils/date';

type Props = {
  groupe: ProduitGroupe | null;
  visible: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onConsumeUnit: (u: Produit) => void;
};

export default function LotDetailModal({ groupe, visible, onClose, onRefresh, onConsumeUnit }: Props) {
  const [editingLot, setEditingLot] = useState(false);
  const [lotNom, setLotNom] = useState('');
  const [lotCategorie, setLotCategorie] = useState('');
  const [editingUnitId, setEditingUnitId] = useState<number | null>(null);
  const [unitDlcDraft, setUnitDlcDraft] = useState('');

  if (!groupe) return null;

  const commencerEditionLot = () => {
    setLotNom(groupe.nom);
    setLotCategorie(groupe.categorie ?? '');
    setEditingLot(true);
  };

  const sauvegarderLot = () => {
    groupe.unites.forEach((u) => updateProduit(u.id, { nom: lotNom, categorie: lotCategorie.trim() || null }));
    setEditingLot(false);
    onRefresh();
  };

  const ouvrirUnite = (u: Produit) => {
    const duree = u.duree_apres_ouverture ?? 3;
    const nouvelleDate = new Date();
    nouvelleDate.setDate(nouvelleDate.getDate() + duree);
    const iso = nouvelleDate.toISOString().split('T')[0];
    toggleOuvert(u.id, iso);
    scheduleForProduit({ ...u, est_ouvert: 1, date_peremption_effective: iso } as Produit);
    onRefresh();
  };

  const commencerEditionDlc = (u: Produit) => {
    setEditingUnitId(u.id);
    setUnitDlcDraft(u.date_peremption_effective ?? '');
  };

  const sauvegarderDlc = (u: Produit) => {
    updateProduit(u.id, { date_peremption_effective: unitDlcDraft });
    scheduleForProduit({ ...u, date_peremption_effective: unitDlcDraft } as Produit);
    setEditingUnitId(null);
    onRefresh();
  };

  const marquerJete = (u: Produit) => {
    Alert.alert('Marquer comme jeté', `"${groupe.nom}" sera compté comme jeté.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Confirmer',
        style: 'destructive',
        onPress: () => {
          markUnitFini(u.id, 'jete');
          cancelForProduit(u.id);
          onRefresh();
        },
      },
    ]);
  };

  const supprimerDefinitivement = (u: Produit) => {
    Alert.alert('Supprimer cette entrée', "Cette action efface définitivement l'unité (à utiliser en cas d'erreur de saisie, pas pour du gaspillage).", [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          deleteProduit(u.id);
          cancelForProduit(u.id);
          onRefresh();
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.modalWrapper} pointerEvents="box-none">
          <GlassContainer intensity={60} tintColor={colors.surface + 'E6'} style={styles.modalCard}>
            <View style={styles.header}>
              {editingLot ? (
                <TextInput style={styles.nomInput} value={lotNom} onChangeText={setLotNom} placeholderTextColor={colors.textSecondary} />
              ) : (
                <Text style={styles.nom}>{groupe.nom}</Text>
              )}
              <Pressable onPress={() => (editingLot ? setEditingLot(false) : commencerEditionLot())} style={styles.editButton}>
                <Ionicons name={editingLot ? 'close-outline' : 'pencil-outline'} size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            {editingLot ? (
              <View style={{ gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.md }}>
                <View>
                  <Text style={styles.label}>Catégorie</Text>
                  <TextInput style={styles.textInput} value={lotCategorie} onChangeText={setLotCategorie} placeholderTextColor={colors.textSecondary} />
                </View>
                <Pressable style={styles.primaryButton} onPress={sauvegarderLot}>
                  <Ionicons name="checkmark-outline" size={18} color={colors.background} />
                  <Text style={styles.primaryButtonText}>Enregistrer</Text>
                </Pressable>
              </View>
            ) : (
              groupe.categorie && <Text style={styles.categorie}>{groupe.categorie}</Text>
            )}

            <ScrollView style={styles.unitesList} showsVerticalScrollIndicator={false}>
              {groupe.unites.map((u, index) => {
                const jours = joursRestants(u.date_peremption_effective);
                const level = urgenceLevel(jours);
                const statusColor = couleurUrgence(level);
                const labelJours =
                  jours === null ? 'Date inconnue' : jours < 0 ? `Périmé depuis ${Math.abs(jours)}j` : jours === 0 ? "Périme aujourd'hui" : `J-${jours}`;
                const enEdition = editingUnitId === u.id;

                return (
                  <View key={u.id} style={styles.uniteCard}>
                    <View style={styles.uniteTopRow}>
                      <View style={styles.uniteTitleGroup}>
                        <StatusDot color={statusColor} size={11} />
                        <Text style={styles.uniteLabel}>Unité {index + 1}</Text>
                      </View>
                      <Pressable onPress={() => (enEdition ? setEditingUnitId(null) : commencerEditionDlc(u))} style={styles.editButtonSmall}>
                        <Ionicons name={enEdition ? 'close-outline' : 'pencil-outline'} size={16} color={colors.textSecondary} />
                      </Pressable>
                    </View>

                    <Text style={[styles.uniteCompteur, { color: statusColor }]}>{labelJours}</Text>

                    <View style={styles.uniteInfoRow}>
                      <Text style={styles.uniteDate}>DLC : {formatDateAffichage(u.date_peremption_effective)}</Text>
                      <Text style={styles.uniteStatut}>Produit {u.est_ouvert ? 'Ouvert' : 'Fermé'}</Text>
                    </View>

                    {enEdition && (
                      <View style={styles.editDlcBlock}>
                        <DateField label="Nouvelle DLC" value={unitDlcDraft} onChange={setUnitDlcDraft} />
                        <Pressable style={styles.saveSmallButton} onPress={() => sauvegarderDlc(u)}>
                          <Text style={styles.saveSmallButtonText}>Valider</Text>
                        </Pressable>
                      </View>
                    )}

                    <View style={styles.uniteActions}>
                      <Pressable style={[styles.miniButton, styles.miniButtonBad]} onPress={() => marquerJete(u)}>
                        <Ionicons name="trash-outline" size={16} color={colors.critical} />
                        <Text style={[styles.miniButtonText, { color: colors.critical }]}>Jeté</Text>
                      </Pressable>
                      <Pressable style={[styles.miniButton, styles.miniButtonGood]} onPress={() => onConsumeUnit(u)}>
                        <Ionicons name="checkmark-circle-outline" size={16} color={colors.fresh} />
                        <Text style={[styles.miniButtonText, { color: colors.fresh }]}>Consommé</Text>
                      </Pressable>
                      {u.est_ouvert === 0 && (
                        <Pressable style={styles.miniButton} onPress={() => ouvrirUnite(u)}>
                          <Ionicons name="lock-open-outline" size={16} color={colors.textPrimary} />
                          <Text style={styles.miniButtonText}>Ouvrir</Text>
                        </Pressable>
                      )}
                    </View>

                    <Pressable onPress={() => supprimerDefinitivement(u)} style={styles.erreurSaisieWrapper}>
                      <Text style={styles.erreurSaisie}>Erreur de saisie, supprimer définitivement</Text>
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          </GlassContainer>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(3,5,12,0.65)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  modalWrapper: { width: '100%', maxWidth: 400, maxHeight: '88%' },
  modalCard: {},
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  editButton: { padding: 6 },
  nom: { fontFamily: fonts.display, fontSize: 21, color: colors.textPrimary, flexShrink: 1, marginRight: spacing.sm },
  nomInput: { fontFamily: fonts.display, fontSize: 21, color: colors.textPrimary, flexShrink: 1, marginRight: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder, paddingVertical: 4, flex: 1 },
  categorie: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, marginTop: 4, marginBottom: spacing.md },
  label: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginBottom: 6 },
  textInput: { fontFamily: fonts.body, fontSize: 15, color: colors.textPrimary, borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: 12 },
  primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.accent, paddingVertical: 12, borderRadius: radius.pill },
  primaryButtonText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.background },

  unitesList: { maxHeight: 480, marginTop: spacing.sm },

  uniteCard: {
    backgroundColor: colors.background + 'B0',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radius.button,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  uniteTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  uniteTitleGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  uniteLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textSecondary },
  editButtonSmall: { padding: 6 },
  uniteCompteur: { fontFamily: fonts.mono, fontSize: 15 },
  uniteInfoRow: { flexDirection: 'row', gap: spacing.md },
  uniteStatut: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  uniteDate: { fontFamily: fonts.body, fontSize: 12, color: colors.textPrimary },

  editDlcBlock: { gap: spacing.sm, marginTop: spacing.xs, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.surfaceBorder },
  saveSmallButton: { backgroundColor: colors.accent, paddingVertical: 10, borderRadius: radius.pill, alignItems: 'center' },
  saveSmallButtonText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.background },

  uniteActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  miniButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  miniButtonGood: { borderColor: colors.fresh },
  miniButtonBad: { borderColor: colors.critical },
  miniButtonText: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.textPrimary },

  erreurSaisieWrapper: { marginTop: spacing.xs, paddingVertical: 4 },
  erreurSaisie: { fontFamily: fonts.body, fontSize: 11, color: colors.textSecondary, textDecorationLine: 'underline' },
});