import { useEffect } from "react";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Notification } from "@db/schema";
import { Bell, BellRing } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotificationToastProps {
  notification: Notification;
}

export function NotificationToast({ notification }: NotificationToastProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mark notification as read
  const markAsRead = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/notifications/${notification.id}/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: notification.userId }),
      });
      if (!response.ok) throw new Error('Failed to mark notification as read');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to mark notification as read",
        variant: "destructive",
      });
    },
  });

  return (
    <Toast>
      <div className="grid gap-1">
        <div className="flex items-center gap-2">
          {notification.status === 'read' ? (
            <Bell className="h-4 w-4" />
          ) : (
            <BellRing className="h-4 w-4 text-primary animate-pulse" />
          )}
          <ToastTitle>{notification.title}</ToastTitle>
        </div>
        <ToastDescription>
          {notification.body}
        </ToastDescription>
      </div>
      <ToastClose onClick={() => markAsRead.mutate()} />
    </Toast>
  );
}

export function NotificationsList() {
  const { toast } = useToast();
  const { data: notifications } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    queryFn: async () => {
      const userId = 1; // TODO: Get from auth context
      const response = await fetch(`/api/notifications?userId=${userId}`);
      if (!response.ok) throw new Error('Failed to fetch notifications');
      return response.json();
    },
  });

  useEffect(() => {
    // Request notification permission on component mount
    if ('Notification' in window) {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          // Register service worker for push notifications
          navigator.serviceWorker.ready.then((registration) => {
            registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: process.env.VITE_VAPID_PUBLIC_KEY
            }).then(async (subscription) => {
              // Send subscription to backend
              await fetch('/api/notifications/subscribe', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  userId: 1, // TODO: Get from auth context
                  channel: 'web_push',
                  endpoint: subscription.endpoint,
                  keys: {
                    p256dh: btoa(String.fromCharCode.apply(null, 
                      new Uint8Array(subscription.getKey('p256dh') as ArrayBuffer))),
                    auth: btoa(String.fromCharCode.apply(null, 
                      new Uint8Array(subscription.getKey('auth') as ArrayBuffer))),
                  },
                }),
              });
            }).catch((error) => {
              console.error('Failed to subscribe to push notifications:', error);
            });
          });
        }
      });
    }
  }, []);

  return (
    <ToastProvider>
      {notifications?.map((notification) => (
        <NotificationToast
          key={notification.id}
          notification={notification}
        />
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}