import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
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

interface ChatClient extends WebSocket {
  userId?: number;
  isAlive: boolean;
  lastActivity: number;
}

export interface WebSocketInterface {
  broadcast: (message: NotificationMessage) => void;
  cleanup: () => Promise<void>;
}

export async function setupWebSocket(server: Server): Promise<WebSocketInterface> {
  return new Promise<WebSocketInterface>((resolve, reject) => {
    try {
      log('Initializing WebSocket server...');

      // Create a new WebSocket server on port 5001
      const wss = new WebSocketServer({ 
        port: 5001,
        clientTracking: true,
        perMessageDeflate: false
      });

      const clients = new Set<ChatClient>();
      let cleanupInterval: NodeJS.Timeout;

      const startCleanup = () => {
        cleanupInterval = setInterval(() => {
          try {
            const now = Date.now();
            clients.forEach(client => {
              if (!client.isAlive || now - client.lastActivity > 60000) {
                client.terminate();
                clients.delete(client);
                return;
              }
              client.ping();
            });
          } catch (error) {
            console.error('WebSocket cleanup error:', error);
          }
        }, 30000);
      };

      const cleanup = async () => {
        clearInterval(cleanupInterval);
        const closePromises = Array.from(clients).map(client => 
          new Promise<void>(resolve => {
            client.once('close', () => resolve());
            client.terminate();
          })
        );
        await Promise.all(closePromises);
        clients.clear();
        wss.close();
      };

      const broadcast = (message: NotificationMessage) => {
        const messageStr = JSON.stringify(message);
        log(`Broadcasting message: ${message.type}`);

        const deadClients = new Set<ChatClient>();

        clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            try {
              client.send(messageStr);
            } catch (error) {
              console.error('Broadcast error:', error);
              deadClients.add(client);
            }
          } else {
            deadClients.add(client);
          }
        });

        deadClients.forEach(client => {
          client.terminate();
          clients.delete(client);
        });
      };

      wss.on('connection', (wsClient: WebSocket) => {
        try {
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

          client.send(JSON.stringify({
            type: 'connected',
            timestamp: new Date().toISOString(),
            message: 'Connected to ICU Schedule notifications'
          }));

        } catch (error) {
          console.error('WebSocket connection handler error:', error);
        }
      });

      wss.on('error', (error: Error) => {
        console.error('WebSocket server error:', error);
        cleanup().catch(console.error);
        reject(error);
      });

      wss.on('listening', () => {
        log('WebSocket server is listening on port 5001');
        startCleanup();
        resolve({ broadcast, cleanup });
      });

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