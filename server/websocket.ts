import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'http';
import { type TimeOffRequest, type Shift, type Message, type ChatRoom } from '@db/schema';

interface NotificationMessage {
  type: 'shift_created' | 'shift_updated' | 'shift_deleted' | 'shift_swap_requested' | 'shift_swap_responded' | 'shift_swap_cancelled' | 'time_off_requested' | 'time_off_responded' | 'time_off_cancelled' | 'chat_message' | 'urgent_coverage';
  data: any;
  timestamp: string;
  user?: {
    name: string;
    title: string;
  };
}

interface ChatClient extends WebSocket {
  userId?: number;
  rooms?: Set<number>;
}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ 
    server,
    path: '/ws',
  });

  const clients = new Set<ChatClient>();
  const roomSubscriptions = new Map<number, Set<ChatClient>>();

  wss.on('connection', (ws: ChatClient) => {
    clients.add(ws);

    ws.on('message', async (data: string) => {
      try {
        const message = JSON.parse(data);

        // Handle authentication
        if (message.type === 'auth') {
          ws.userId = message.userId;
          ws.rooms = new Set();
          return;
        }

        // Handle room subscription
        if (message.type === 'join_room') {
          const roomId = message.roomId;
          ws.rooms?.add(roomId);

          let roomClients = roomSubscriptions.get(roomId);
          if (!roomClients) {
            roomClients = new Set();
            roomSubscriptions.set(roomId, roomClients);
          }
          roomClients.add(ws);
          return;
        }

        // Handle room unsubscription
        if (message.type === 'leave_room') {
          const roomId = message.roomId;
          ws.rooms?.delete(roomId);
          roomSubscriptions.get(roomId)?.delete(ws);
          return;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      // Remove from all room subscriptions
      if (ws.rooms) {
        for (const roomId of ws.rooms) {
          roomSubscriptions.get(roomId)?.delete(ws);
        }
      }
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
    requestor: { name: string; title: string; userType?: string },
    recipient: { name: string; title: string; userType?: string },
    requestId: number
  ) => ({
    type: 'shift_swap_requested' as const,
    data: { shift, requestor, recipient, requestId },
    timestamp: new Date().toISOString(),
  }),

  shiftSwapResponded: (
    shift: Shift,
    requestor: { name: string; title: string; userType?: string },
    recipient: { name: string; title: string; userType?: string },
    status: 'accepted' | 'rejected'
  ) => ({
    type: 'shift_swap_responded' as const,
    data: { shift, requestor, recipient, status },
    timestamp: new Date().toISOString(),
  }),

  shiftSwapCancelled: (
    shift: Shift,
    requestor: { name: string; title: string; userType?: string },
    recipient: { name: string; title: string; userType?: string }
  ) => ({
    type: 'shift_swap_cancelled' as const,
    data: { shift, requestor, recipient },
    timestamp: new Date().toISOString(),
  }),

  timeOffRequested: (request: TimeOffRequest, user: { name: string; title: string }) => ({
    type: 'time_off_requested' as const,
    data: request,
    user,
    timestamp: new Date().toISOString(),
  }),

  timeOffResponded: (request: TimeOffRequest, user: { name: string; title: string }, status: 'approved' | 'rejected') => ({
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

  chatMessage: (message: Message, room: ChatRoom, sender: { name: string; title: string }) => ({
    type: 'chat_message' as const,
    data: {
      message,
      room,
      sender
    },
    timestamp: new Date().toISOString(),
    user: sender
  }),

  urgentCoverage: (shift: Shift, requester: { name: string; title: string }) => ({
    type: 'urgent_coverage' as const,
    data: {
      shift,
      requester
    },
    timestamp: new Date().toISOString(),
    user: requester
  })
};