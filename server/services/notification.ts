import { db } from "@db";
import { eq, and } from "drizzle-orm";
import { 
  notifications, 
  notificationSubscriptions,
  type NotificationType,
  type NotificationChannel,
  type Notification
} from "@db/schema";
import type WebSocket from 'ws';

export class NotificationService {
  private webSocketClients: Map<number, WebSocket> = new Map();

  /**
   * Register a WebSocket client for a user
   */
  registerWebSocket(userId: number, ws: WebSocket) {
    this.webSocketClients.set(userId, ws);

    ws.on('close', () => {
      this.webSocketClients.delete(userId);
    });
  }

  /**
   * Create and send a notification to a user
   */
  async notify(
    userId: number,
    type: NotificationType,
    title: string,
    body: string,
    data: Record<string, any> = {}
  ) {
    try {
      // Get user's notification subscriptions
      const subscriptions = await db.query.notificationSubscriptions.findMany({
        where: eq(notificationSubscriptions.userId, userId),
      });

      // Create notifications for each subscription
      const notificationPromises = subscriptions.map(async (sub) => {
        const notification = await db.insert(notifications)
          .values({
            userId,
            type,
            title,
            body,
            data,
            channel: sub.channel,
          })
          .returning();

        await this.sendNotification(notification[0], sub);
      });

      await Promise.all(notificationPromises);
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  }

  /**
   * Send a notification through the appropriate channel
   */
  private async sendNotification(
    notification: Notification,
    subscription: any
  ) {
    try {
      switch (subscription.channel) {
        case 'websocket':
          await this.sendWebSocketNotification(notification);
          break;
        case 'web_push':
          await this.sendWebPushNotification(notification, subscription);
          break;
        case 'email':
          await this.sendEmailNotification(notification, subscription);
          break;
      }

      // Mark notification as sent
      await db.update(notifications)
        .set({ 
          status: 'sent',
          sentAt: new Date()
        })
        .where(eq(notifications.id, notification.id));

    } catch (error) {
      console.error(`Failed to send notification through ${subscription.channel}:`, error);
      
      // Mark notification as failed
      await db.update(notifications)
        .set({ status: 'failed' })
        .where(eq(notifications.id, notification.id));
    }
  }

  /**
   * Send notification via WebSocket
   */
  private async sendWebSocketNotification(notification: Notification) {
    const ws = this.webSocketClients.get(notification.userId);
    if (!ws) return;

    ws.send(JSON.stringify({
      type: 'notification',
      data: notification
    }));
  }

  /**
   * Send notification via Web Push
   */
  private async sendWebPushNotification(
    notification: Notification,
    subscription: any
  ) {
    // Implementation for web push notifications
    // This will be implemented when we add web push support
    console.log('Web Push notification to be implemented');
  }

  /**
   * Send notification via Email
   */
  private async sendEmailNotification(
    notification: Notification,
    subscription: any
  ) {
    // Implementation for email notifications
    // This will be implemented when we add email support
    console.log('Email notification to be implemented');
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: number, userId: number) {
    await db.update(notifications)
      .set({ 
        status: 'read',
        readAt: new Date()
      })
      .where(and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      ));
  }

  /**
   * Get all notifications for a user
   */
  async getUserNotifications(userId: number) {
    return db.query.notifications.findMany({
      where: eq(notifications.userId, userId),
      orderBy: (notifications, { desc }) => [desc(notifications.createdAt)],
    });
  }
}

export const notificationService = new NotificationService();
