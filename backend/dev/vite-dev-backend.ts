import { randomUUID } from 'node:crypto';
import type { Plugin } from 'vite';
import { WebSocketServer, type WebSocket } from 'ws';
import { DEV_WEBSOCKET_PATH } from '../../shared/protocol';
import { MemorySessionStore } from '../memory-session-store';
import { SessionService } from '../session-service';

/**
 * Serves the real session logic on an in-memory store from the Vite dev server,
 * so `npm run dev` works without AWS. Sessions last until the dev server exits.
 */
export function devBackend(): Plugin {
  return {
    name: 'moodswing-dev-backend',
    apply: 'serve',
    configureServer(server) {
      const sockets = new Map<string, WebSocket>();
      const service = new SessionService({
        store: new MemorySessionStore(),
        broadcaster: {
          async send(connectionIds, message) {
            const data = JSON.stringify(message);
            const gone: string[] = [];

            for (const connectionId of connectionIds) {
              const socket = sockets.get(connectionId);

              if (socket && socket.readyState === socket.OPEN) {
                socket.send(data);
              } else {
                gone.push(connectionId);
              }
            }

            return gone;
          },
        },
      });
      const webSocketServer = new WebSocketServer({ noServer: true });

      // Vite's own HMR socket uses a different path, so only claim ours.
      server.httpServer?.on('upgrade', (request, socket, head) => {
        if (new URL(request.url ?? '/', 'http://localhost').pathname !== DEV_WEBSOCKET_PATH) {
          return;
        }

        webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
          const connectionId = randomUUID();

          sockets.set(connectionId, webSocket);
          webSocket.on('message', (data) => {
            void service.handleRawMessage(connectionId, data.toString());
          });
          webSocket.on('close', () => {
            sockets.delete(connectionId);
            service.handleDisconnect(connectionId).catch((error) => console.error(error));
          });
        });
      });
    },
  };
}
