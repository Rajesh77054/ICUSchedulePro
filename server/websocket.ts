import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'http';
import { type shifts } from '@db/schema';

interface NotificationMessage {
  type: 'shift_created' | 'shift_updated' | 'shift_swap_requested';
  data: any;
  timestamp: string;
  provider?: {
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
  shiftCreated: (shift: typeof shifts.$inferSelect, provider: { name: string; title: string }) => ({
    type: 'shift_created' as const,
    data: shift,
    provider,
    timestamp: new Date().toISOString(),
  }),

  shiftUpdated: (shift: typeof shifts.$inferSelect, provider: { name: string; title: string }) => ({
    type: 'shift_updated' as const,
    data: shift,
    provider,
    timestamp: new Date().toISOString(),
  }),

  shiftSwapRequested: (
    shift: typeof shifts.$inferSelect,
    requestor: { name: string; title: string },
    recipient: { name: string; title: string }
  ) => ({
    type: 'shift_swap_requested' as const,
    data: { shift, requestor, recipient },
    timestamp: new Date().toISOString(),
  }),
};