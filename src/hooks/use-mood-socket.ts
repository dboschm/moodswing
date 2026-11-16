import { createContext, useContext, useEffect, useState } from 'react';
import type { ConnectionStatus, MoodSocket } from '../mood-socket';

export const MoodSocketContext = createContext<MoodSocket | null>(null);

export function useMoodSocket(): MoodSocket {
  const socket = useContext(MoodSocketContext);

  if (!socket) {
    throw new Error('useMoodSocket needs a MoodSocketContext provider');
  }

  return socket;
}

export function useConnectionStatus(): ConnectionStatus {
  const socket = useMoodSocket();
  const [status, setStatus] = useState(() => socket.getStatus());

  useEffect(() => {
    setStatus(socket.getStatus());
    return socket.onStatus(setStatus);
  }, [socket]);

  return status;
}
