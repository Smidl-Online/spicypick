import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

const expo = new Expo();

export async function sendPushNotification(
  pushToken: string,
  notification: { title: string; body: string; data?: Record<string, unknown> },
): Promise<void> {
  if (!Expo.isExpoPushToken(pushToken)) {
    console.warn(`[PUSH] Invalid push token: ${pushToken}`);
    return;
  }

  const message: ExpoPushMessage = {
    to: pushToken,
    sound: 'default',
    title: notification.title,
    body: notification.body,
    data: notification.data || {},
  };

  try {
    const [ticket] = await expo.sendPushNotificationsAsync([message]);
    if (ticket.status === 'error') {
      console.error(`[PUSH] Error sending to ${pushToken}:`, 'message' in ticket ? ticket.message : 'Unknown error');
    }
  } catch (err) {
    console.error(`[PUSH] Failed to send notification:`, err);
  }
}

export async function sendBulkPushNotifications(
  messages: Array<{
    pushToken: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }>,
): Promise<number> {
  const validMessages: ExpoPushMessage[] = messages
    .filter((m) => Expo.isExpoPushToken(m.pushToken))
    .map((m) => ({
      to: m.pushToken,
      sound: 'default' as const,
      title: m.title,
      body: m.body,
      data: m.data || {},
    }));

  if (validMessages.length === 0) return 0;

  const chunks = expo.chunkPushNotifications(validMessages);
  let sent = 0;

  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      sent += tickets.filter((t: ExpoPushTicket) => t.status === 'ok').length;
    } catch (err) {
      console.error(`[PUSH] Chunk send failed:`, err);
    }
  }

  return sent;
}
