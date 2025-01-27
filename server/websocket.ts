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
  return new Promise<WebSocketInterface>((resolve) => {
    const wss = new WebSocketServer({ 
      noServer: true,
      clientTracking: true,
      perMessageDeflate: false
    });

    const clients = new Set<ChatClient>();
    let cleanupInterval: NodeJS.Timeout;

    // Handle upgrade requests
    server.on('upgrade', (request, socket, head) => {
      // Skip Vite HMR upgrade requests
      if (request.headers['sec-websocket-protocol'] === 'vite-hmr') {
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws);
      });
    });

    wss.on('connection', (wsClient: WebSocket) => {
      const client = wsClient as ChatClient;
      client.isAlive = true;
      client.lastActivity = Date.now();
      clients.add(client);

      log(`New WebSocket connection established, total clients: ${clients.size}`);

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
        clients.delete(client);
        try {
          client.terminate();
        } catch (e) {
          console.error('Error terminating client:', e);
        }
      });

      // Send connection confirmation
      try {
        client.send(JSON.stringify({
          type: 'connected',
          timestamp: new Date().toISOString(),
          message: 'Connected to ICU Schedule notifications'
        }));
      } catch (error) {
        console.error('Error sending connection confirmation:', error);
        clients.delete(client);
      }
    });

    // Cleanup function that ensures all connections are properly closed
    const cleanup = async () => {
      log('Starting WebSocket cleanup...');

      clearInterval(cleanupInterval);

      const closePromises = Array.from(clients).map(client => 
        new Promise<void>(resolve => {
          try {
            client.terminate();
            clients.delete(client);
          } catch (e) {
            console.error('Error terminating client during cleanup:', e);
          }
          resolve();
        })
      );

      await Promise.all(closePromises);
      clients.clear();

      await new Promise<void>(resolve => {
        wss.close(() => {
          log('WebSocket server closed');
          resolve();
        });
      });
    };

    // Start periodic cleanup of dead connections
    cleanupInterval = setInterval(() => {
      const now = Date.now();
      clients.forEach(client => {
        if (!client.isAlive || now - client.lastActivity > 60000) {
          try {
            client.terminate();
            clients.delete(client);
          } catch (error) {
            console.error('Error during periodic cleanup:', error);
          }
          return;
        }
        try {
          client.ping();
        } catch (error) {
          console.error('Error sending ping:', error);
          clients.delete(client);
        }
      });
    }, 30000);

    // Broadcast function with error handling
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

      // Cleanup dead clients
      deadClients.forEach(client => {
        try {
          client.terminate();
        } catch (e) {
          console.error('Error terminating dead client:', e);
        }
        clients.delete(client);
      });
    };

    log('WebSocket server initialized successfully');
    resolve({ broadcast, cleanup });
  });
}

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