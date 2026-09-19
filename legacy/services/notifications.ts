import * as Notifications from 'expo-notifications';
import { Produit } from '../db/queries';
import { getSetting, setSetting } from '../db/settings';
import { formatDateAffichage } from '../utils/date';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  return finalStatus === 'granted';
}

export function notificationsEnabled(): boolean {
  return getSetting('notifications_enabled') !== '0'; // activées par défaut
}

export function setNotificationsEnabled(enabled: boolean) {
  setSetting('notifications_enabled', enabled ? '1' : '0');
}

function identifierFor(id: number) {
  return `produit_${id}`;
}

export async function cancelForProduit(id: number) {
  await Notifications.cancelScheduledNotificationAsync(identifierFor(id)).catch(() => {});
}

export async function scheduleForProduit(produit: Produit) {
  await cancelForProduit(produit.id);

  if (!notificationsEnabled()) return;
  if (!produit.date_peremption_effective) return;

  const datePeremption = new Date(produit.date_peremption_effective);
  const trigger = new Date(datePeremption);
  trigger.setDate(trigger.getDate() - 1);
  trigger.setHours(19, 0, 0, 0);

  if (trigger.getTime() <= Date.now()) return;

  await Notifications.scheduleNotificationAsync({
    identifier: identifierFor(produit.id),
    content: {
      title: 'Péremption proche',
      body: `${produit.nom} périme demain (${formatDateAffichage(produit.date_peremption_effective)}).`,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
  });
}

export async function rescheduleAll(produits: Produit[]) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!notificationsEnabled()) return;
  for (const p of produits) {
    await scheduleForProduit(p);
  }
}