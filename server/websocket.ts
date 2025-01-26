import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import { log } from './vite';

interface NotificationUser {
  name: string;
  title: string;
  color: string;
}

interface NotificationShift {
  id: number;
  startDate: string;
  endDate: string;
  status: string;
  user: NotificationUser;
}

interface NotificationMessage {
  type: 'shift_created' | 'shift_updated' | 'shift_deleted' | 'shift_swap_requested' | 'shift_swap_responded' | 'shift_swap_cancelled' | 'time_off_requested' | 'time_off_responded' | 'time_off_cancelled' | 'chat_message' | 'urgent_coverage';
  data: any;
  timestamp: string;
}

interface ChatClient extends WebSocket {
  userId?: number;
  isAlive: boolean;
  lastActivity: number;
}

export async function setupWebSocket(server: Server) {
  return new Promise<{ broadcast: (message: NotificationMessage) => void }>((resolve) => {
    const wss = new WebSocketServer({ 
      server,
      path: '/ws',
      clientTracking: true
    });

    const clients = new Set<ChatClient>();

    // Connection cleanup interval
    const cleanup = setInterval(() => {
      const now = Date.now();
      clients.forEach(client => {
        if (!client.isAlive || now - client.lastActivity > 60000) {
          client.terminate();
          clients.delete(client);
          return;
        }
        client.isAlive = false;
        client.ping();
      });
    }, 30000);

    wss.on('close', () => {
      clearInterval(cleanup);
    });

    wss.on('connection', (ws: ChatClient) => {
      ws.isAlive = true;
      ws.lastActivity = Date.now();
      clients.add(ws);

      ws.on('pong', () => {
        ws.isAlive = true;
        ws.lastActivity = Date.now();
      });

      ws.on('message', (data: string) => {
        try {
          const message = JSON.parse(data);
          ws.lastActivity = Date.now();

          switch (message.type) {
            case 'auth':
              ws.userId = message.userId;
              log(`Client authenticated: ${message.userId}`);
              break;

            default:
              log(`Unknown message type: ${message.type}`);
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });

      ws.on('close', () => {
        clients.delete(ws);
        log(`Client disconnected, remaining clients: ${clients.size}`);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        ws.terminate();
        clients.delete(ws);
      });

      // Send initial connection message
      ws.send(JSON.stringify({
        type: 'connected',
        timestamp: new Date().toISOString(),
        message: 'Connected to ICU Schedule notifications'
      }));
    });

    // Wait for WebSocket server to be ready
    wss.on('listening', () => {
      const broadcast = (message: NotificationMessage) => {
        const messageStr = JSON.stringify(message);
        log(`Broadcasting message: ${message.type}`);

        clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            try {
              client.send(messageStr);
            } catch (error) {
              console.error('Broadcast error:', error);
              client.terminate();
              clients.delete(client);
            }
          }
        });
      };

      resolve({ broadcast });
    });
  });
}

// Type-safe notification creator functions
export const notify = {
  shiftSwapRequested: (
    shift: NotificationShift,
    requestor: NotificationUser,
    recipient: NotificationUser,
    requestId: number
  ): NotificationMessage => ({
    type: 'shift_swap_requested',
    data: { shift, requestor, recipient, requestId },
    timestamp: new Date().toISOString(),
  }),

  shiftSwapResponded: (
    shift: NotificationShift,
    requestor: NotificationUser,
    recipient: NotificationUser,
    status: 'accepted' | 'rejected'
  ): NotificationMessage => ({
    type: 'shift_swap_responded',
    data: { shift, requestor, recipient, status },
    timestamp: new Date().toISOString(),
  })
};