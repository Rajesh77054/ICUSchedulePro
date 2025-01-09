import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, X, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface Notification {
  type: 'shift_created' | 'shift_updated' | 'shift_deleted' | 'shift_swap_requested' | 'shift_swap_responded';
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
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch existing swap requests
  const { data: swapRequests, isLoading } = useQuery({
    queryKey: ['/api/swap-requests'],
    queryFn: async () => {
      const res = await fetch('/api/swap-requests');
      if (!res.ok) throw new Error('Failed to fetch swap requests');
      return res.json();
    }
  });

  const { mutate: respondToSwap, isLoading: isResponding } = useMutation({
    mutationFn: async ({ requestId, status }: { requestId: number; status: 'accepted' | 'rejected' }) => {
      setError(null);
      const res = await fetch(`/api/swap-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to respond to swap request');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/shifts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/swap-requests'] });
      toast({
        title: 'Success',
        description: `Successfully ${variables.status} the shift swap request.`,
      });
      // Remove the notification for this request
      setNotifications(prev => 
        prev.filter(n => 
          n.type !== 'shift_swap_requested' || 
          n.data.requestId !== variables.requestId
        )
      );
    },
    onError: (error: Error) => {
      setError(error.message);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    // Add pending swap requests to notifications
    if (swapRequests) {
      const pendingRequests = swapRequests
        .filter((req: any) => req.status === 'pending')
        .map((req: any) => ({
          type: 'shift_swap_requested' as const,
          data: {
            shift: req.shift,
            requestor: req.requestor,
            recipient: req.recipient,
            requestId: req.id
          },
          timestamp: req.createdAt
        }));

      setNotifications(prev => {
        // Remove any existing pending requests to avoid duplicates
        const filtered = prev.filter(n => 
          n.type !== 'shift_swap_requested' ||
          !pendingRequests.some(p => p.data.requestId === n.data.requestId)
        );
        return [...pendingRequests, ...filtered];
      });
    }
  }, [swapRequests]);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onmessage = (event) => {
      const notification = JSON.parse(event.data);
      if (notification.type === 'connected') return;

      // Remove duplicate notifications based on type and data
      setNotifications(prev => {
        const isDuplicate = prev.some(n => 
          n.type === notification.type && 
          JSON.stringify(n.data) === JSON.stringify(notification.data)
        );
        if (isDuplicate) return prev;
        return [notification, ...prev];
      });

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
        return `${notification.data.requestor.name} requested to swap shift with ${notification.data.recipient.name} (${format(new Date(notification.data.shift.startDate), 'MMM d')} - ${format(new Date(notification.data.shift.endDate), 'MMM d')})`;
      case 'shift_swap_responded':
        return `${notification.data.recipient.name} ${notification.data.status} your shift swap request`;
      default:
        return 'Unknown notification';
    }
  };

  const renderActions = (notification: Notification) => {
    if (notification.type === 'shift_swap_requested') {
      const swapRequest = notification.data;
      if (!swapRequest || !swapRequest.requestId) return null;

      return (
        <div className="flex gap-2 mt-2">
          <Button
            size="sm"
            onClick={() => respondToSwap({ 
              requestId: swapRequest.requestId,
              status: 'accepted'
            })}
            disabled={isResponding}
          >
            <Check className="h-4 w-4 mr-1" />
            {isResponding ? 'Processing...' : 'Accept'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => respondToSwap({ 
              requestId: swapRequest.requestId,
              status: 'rejected'
            })}
            disabled={isResponding}
          >
            <X className="h-4 w-4 mr-1" />
            {isResponding ? 'Processing...' : 'Decline'}
          </Button>
        </div>
      );
    }
    return null;
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (isOpen) {
        setHasNew(false);
        setError(null);
      }
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
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              No notifications to display
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {notifications.map((notification, i) => (
                <motion.div
                  key={`${notification.type}-${notification.timestamp}`}
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
                  {renderActions(notification)}
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}