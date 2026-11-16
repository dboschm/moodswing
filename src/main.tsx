import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import { resolveWebSocketUrl } from './config';
import { MoodSocketContext } from './hooks/use-mood-socket';
import { MoodSocket } from './mood-socket';

const socket = new MoodSocket({ resolveUrl: resolveWebSocketUrl });
socket.start();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MoodSocketContext.Provider value={socket}>
      <App />
    </MoodSocketContext.Provider>
  </StrictMode>,
);
