import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'http';
import { type TimeOffRequest, type Shift, type User } from '@db/schema';

interface NotificationMessage {
  type: 'shift_created' | 'shift_updated' | 'shift_deleted' | 'shift_swap_requested' | 'shift_swap_responded' | 'time_off_requested' | 'time_off_responded' | 'time_off_cancelled';
  data: any;
  timestamp: string;
  user?: {
    name: string;
    title: string;
  };
}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ 
    server,
    path: '/ws',
  });

  const clients = new Set<WebSocket>();

  wss.on('connection', (ws) => {
    clients.add(ws);

    ws.on('close', () => {
      clients.delete(ws);
    });

    // Send initial connection success message
    ws.send(JSON.stringify({
      type: 'connected',
      timestamp: new Date().toISOString(),
      message: 'Connected to ICU Schedule notifications'
    }));
  });

  // Broadcast to all connected clients
  const broadcast = (message: NotificationMessage) => {
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  };

  return { broadcast };
}

export const notify = {
  shiftCreated: (shift: Shift, user: { name: string; title: string }) => ({
    type: 'shift_created' as const,
    data: shift,
    user,
    timestamp: new Date().toISOString(),
  }),

  shiftUpdated: (shift: Shift, user: { name: string; title: string }) => ({
    type: 'shift_updated' as const,
    data: shift,
    user,
    timestamp: new Date().toISOString(),
  }),

  shiftDeleted: (shift: Shift, user: { name: string; title: string }) => ({
    type: 'shift_deleted' as const,
    data: shift,
    user,
    timestamp: new Date().toISOString(),
  }),

  shiftSwapRequested: (
    shift: Shift,
    requestor: { name: string; title: string },
    recipient: { name: string; title: string },
    requestId: number
  ) => ({
    type: 'shift_swap_requested' as const,
    data: { shift, requestor, recipient, requestId },
    timestamp: new Date().toISOString(),
  }),

  shiftSwapResponded: (
    shift: Shift,
    requestor: { name: string; title: string },
    recipient: { name: string; title: string },
    status: 'accepted' | 'rejected'
  ) => ({
    type: 'shift_swap_responded' as const,
    data: { shift, requestor, recipient, status },
    timestamp: new Date().toISOString(),
  }),

  timeOffRequested: (request: TimeOffRequest, user: { name: string; title: string }) => ({
    type: 'time_off_requested' as const,
    data: request,
    user,
    timestamp: new Date().toISOString(),
  }),

  timeOffResponded: (request: TimeOffRequest, user: { name: string; title: string }) => ({
    type: 'time_off_responded' as const,
    data: request,
    user,
    timestamp: new Date().toISOString(),
  }),

  timeOffCancelled: (request: TimeOffRequest, user: { name: string; title: string }) => ({
    type: 'time_off_cancelled' as const,
    data: request,
    user,
    timestamp: new Date().toISOString(),
  }),
};