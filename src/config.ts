import { DEV_WEBSOCKET_PATH } from '../shared/protocol';

let deployedUrl: Promise<string> | undefined;

async function fetchDeployedUrl(): Promise<string> {
  const response = await fetch('/config.json', { cache: 'no-store' });
  const config: unknown = await response.json();
  const wsUrl = (config as { wsUrl?: unknown } | null)?.wsUrl;

  if (typeof wsUrl !== 'string') {
    throw new Error('config.json has no wsUrl');
  }

  return wsUrl;
}

/**
 * Where to open the WebSocket: `VITE_WS_URL` wins, the dev server serves its
 * own in-memory backend, and deployed builds read the URL CDK wrote to config.json.
 */
export function resolveWebSocketUrl(): Promise<string> {
  const override = import.meta.env.VITE_WS_URL;

  if (override) {
    return Promise.resolve(override);
  }

  if (import.meta.env.DEV) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return Promise.resolve(`${protocol}//${window.location.host}${DEV_WEBSOCKET_PATH}`);
  }

  deployedUrl ??= fetchDeployedUrl().catch((error: unknown) => {
    deployedUrl = undefined;
    throw error;
  });

  return deployedUrl;
}
