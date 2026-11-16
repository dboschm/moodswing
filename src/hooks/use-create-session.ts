import { useCallback, useEffect, useRef, useState } from 'react';
import { saveCreatorToken } from '../browser-storage';
import { useMoodSocket } from './use-mood-socket';

/** Asks the backend for a new session and remembers this browser as its creator. */
export function useCreateSession(onCreated: (code: string) => void) {
  const socket = useMoodSocket();
  const [creating, setCreating] = useState(false);
  const [failed, setFailed] = useState(false);
  const pendingRef = useRef(false);
  const onCreatedRef = useRef(onCreated);
  onCreatedRef.current = onCreated;

  useEffect(
    () =>
      socket.onMessage((message) => {
        if (!pendingRef.current) {
          return;
        }

        if (message.type === 'sessionCreated') {
          pendingRef.current = false;
          setCreating(false);
          saveCreatorToken(message.code, message.creatorToken);
          onCreatedRef.current(message.code);
        } else if (message.type === 'error' && message.action === 'createSession') {
          pendingRef.current = false;
          setCreating(false);
          setFailed(true);
        }
      }),
    [socket],
  );

  const create = useCallback(() => {
    pendingRef.current = true;
    setCreating(true);
    setFailed(false);
    socket.send({ action: 'createSession' });
  }, [socket]);

  return { create, creating, failed };
}
