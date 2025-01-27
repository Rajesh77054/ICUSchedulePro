import type { Server } from "http";
import ws from "ws";
import { log } from "./vite";

// Type definitions for notifications
interface NotificationUser {
  id: number;
  name: string;
  title: string;
  color: string;
}

interface NotificationShift {
  id: number;
  startDate: string;
  endDate: string;
  status: string;
}

interface NotificationMessage {
  type: 'shift_created' | 'shift_updated' | 'shift_deleted' | 'shift_swap_requested' | 'shift_swap_responded' | 'shift_swap_cancelled' | 'time_off_requested' | 'time_off_responded' | 'time_off_cancelled' | 'chat_message' | 'urgent_coverage';
  data: any;
  timestamp: string;
}

interface ChatClient extends ws {
  userId?: number;
  isAlive: boolean;
  lastActivity: number;
}

export interface WebSocketServer {
  broadcast: (message: NotificationMessage) => void;
}

export async function setupWebSocket(server: Server): Promise<WebSocketServer> {
  return new Promise<WebSocketServer>((resolve, reject) => {
    try {
      const wss = new ws.Server({ 
        server,
        path: '/ws',
        clientTracking: true
      });

      const clients = new Set<ChatClient>();

      // Connection cleanup interval
      const cleanup = setInterval(() => {
        try {
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
        } catch (error) {
          console.error('WebSocket cleanup error:', error);
        }
      }, 30000);

      wss.on('error', (error: Error) => {
        console.error('WebSocket server error:', error);
        clearInterval(cleanup);
        reject(error);
      });

      wss.on('close', () => {
        clearInterval(cleanup);
      });

      // Create broadcast function
      const broadcast = (message: NotificationMessage) => {
        const messageStr = JSON.stringify(message);
        log(`Broadcasting message: ${message.type}`);

        clients.forEach(client => {
          if (client.readyState === ws.OPEN) {
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

      wss.on('connection', (wsClient: ws, req) => {
        try {
          // Ignore vite-hmr connections
          if (req.headers['sec-websocket-protocol']?.includes('vite-hmr')) {
            wsClient.close();
            return;
          }

          const client = wsClient as ChatClient;
          client.isAlive = true;
          client.lastActivity = Date.now();
          clients.add(client);

          log(`New WebSocket connection established, current clients: ${clients.size}`);

          client.on('pong', () => {
            client.isAlive = true;
            client.lastActivity = Date.now();
          });

          client.on('message', (data) => {
            try {
              const message = JSON.parse(data.toString());
              client.lastActivity = Date.now();

              switch (message.type) {
                case 'auth':
                  client.userId = message.userId;
                  log(`Client authenticated: ${message.userId}`);
                  break;

                default:
                  log(`Unknown message type: ${message.type}`);
              }
            } catch (error) {
              console.error('WebSocket message error:', error);
            }
          });

          client.on('close', () => {
            clients.delete(client);
            log(`Client disconnected, remaining clients: ${clients.size}`);
          });

          client.on('error', (error) => {
            console.error('WebSocket client error:', error);
            client.terminate();
            clients.delete(client);
          });

          // Send initial connection message
          client.send(JSON.stringify({
            type: 'connected',
            timestamp: new Date().toISOString(),
            message: 'Connected to ICU Schedule notifications'
          }));
        } catch (error) {
          console.error('WebSocket connection handler error:', error);
        }
      });

      // Resolve with broadcast function
      resolve({ broadcast });

    } catch (error) {
      console.error('WebSocket setup error:', error);
      reject(error);
    }
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