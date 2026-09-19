const JOURS = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];

export function formatDateAffichage(isoDate: string | null | undefined): string {
  if (!isoDate) return '—';
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return isoDate;
  const date = new Date(year, month - 1, day);
  const jour = JOURS[date.getDay()];
  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  return `${jour} ${dd}/${mm}`;
}

export function joursRestants(dateEffective: string | null | undefined): number | null {
  if (!dateEffective) return null;
  const aujourdHui = new Date();
  aujourdHui.setHours(0, 0, 0, 0);
  const dateExp = new Date(dateEffective);
  const diffMs = dateExp.getTime() - aujourdHui.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}