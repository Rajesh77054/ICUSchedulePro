import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";

interface Notification {
  type: 'shift_created' | 'shift_updated' | 'shift_swap_requested';
  data: any;
  timestamp: string;
  provider?: {
    name: string;
    title: string;
  };
}

export function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [hasNew, setHasNew] = useState(false);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onmessage = (event) => {
      const notification = JSON.parse(event.data);
      if (notification.type === 'connected') return;

      setNotifications(prev => [notification, ...prev]);
      if (!open) setHasNew(true);
    };

    return () => {
      ws.close();
    };
  }, [open]);

  const getMessage = (notification: Notification) => {
    switch (notification.type) {
      case 'shift_created':
        return `${notification.provider?.name} created a new shift from ${format(new Date(notification.data.startDate), 'MMM d, yyyy')} to ${format(new Date(notification.data.endDate), 'MMM d, yyyy')}`;
      case 'shift_updated':
        return `${notification.provider?.name} updated their shift to ${format(new Date(notification.data.startDate), 'MMM d, yyyy')} - ${format(new Date(notification.data.endDate), 'MMM d, yyyy')}`;
      case 'shift_swap_requested':
        return `${notification.data.requestor.name} requested to swap shift with ${notification.data.recipient.name}`;
      default:
        return 'Unknown notification';
    }
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (isOpen) setHasNew(false);
    }}>
      <SheetTrigger asChild>
        <Button 
          variant="outline" 
          size="icon"
          className="relative"
        >
          <Bell className="h-5 w-5" />
          {hasNew && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary"
            />
          )}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-5rem)] mt-4">
          <AnimatePresence mode="popLayout">
            {notifications.map((notification, i) => (
              <motion.div
                key={notification.timestamp}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: i * 0.1 }}
                className="p-4 border-b"
              >
                <p className="text-sm">{getMessage(notification)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(notification.timestamp), 'MMM d, h:mm a')}
                </p>
              </motion.div>
            ))}
          </AnimatePresence>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}