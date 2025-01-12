import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'http';
import { type shifts, type timeOffRequests } from '@db/schema';

interface NotificationMessage {
  type: 'shift_created' | 'shift_updated' | 'shift_deleted' | 'shift_swap_requested' | 'shift_swap_responded' | 'time_off_requested' | 'time_off_responded' | 'time_off_cancelled' | 'qgenda_sync_completed' | 'qgenda_sync_failed';
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

  shiftDeleted: (shift: typeof shifts.$inferSelect, provider: { name: string; title: string }) => ({
    type: 'shift_deleted' as const,
    data: shift,
    provider,
    timestamp: new Date().toISOString(),
  }),

  shiftSwapRequested: (
    shift: typeof shifts.$inferSelect,
    requestor: { name: string; title: string },
    recipient: { name: string; title: string },
    requestId: number
  ) => ({
    type: 'shift_swap_requested' as const,
    data: { shift, requestor, recipient, requestId },
    timestamp: new Date().toISOString(),
  }),

  shiftSwapResponded: (
    shift: typeof shifts.$inferSelect,
    requestor: { name: string; title: string },
    recipient: { name: string; title: string },
    status: 'accepted' | 'rejected'
  ) => ({
    type: 'shift_swap_responded' as const,
    data: { shift, requestor, recipient, status },
    timestamp: new Date().toISOString(),
  }),

  timeOffRequested: (request: typeof timeOffRequests.$inferSelect, provider: { name: string; title: string }) => ({
    type: 'time_off_requested' as const,
    data: request,
    provider,
    timestamp: new Date().toISOString(),
  }),

  timeOffResponded: (request: typeof timeOffRequests.$inferSelect, provider: { name: string; title: string }, status: 'approved' | 'rejected') => ({
    type: 'time_off_responded' as const,
    data: { ...request, status },
    provider,
    timestamp: new Date().toISOString(),
  }),

  timeOffCancelled: (request: typeof timeOffRequests.$inferSelect, provider: { name: string; title: string }) => ({
    type: 'time_off_cancelled' as const,
    data: request,
    provider,
    timestamp: new Date().toISOString(),
  }),

  qgendaSyncCompleted: (
    provider: { name: string; title: string },
    syncResult: {
      shiftsImported: number;
      conflicts: Array<{
        type: 'replaced';
        original: typeof shifts.$inferSelect;
        qgendaEvent: {
          startDate: string;
          endDate: string;
          summary: string;
        };
      }>;
    }
  ) => ({
    type: 'qgenda_sync_completed' as const,
    data: syncResult,
    provider,
    timestamp: new Date().toISOString(),
  }),

  qgendaSyncFailed: (
    provider: { name: string; title: string },
    error: string
  ) => ({
    type: 'qgenda_sync_failed' as const,
    data: { error },
    provider,
    timestamp: new Date().toISOString(),
  }),
};