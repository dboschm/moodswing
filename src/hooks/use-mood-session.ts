import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ErrorReason, SessionSnapshot } from '../../shared/protocol';
import { getCreatorToken, getVoterId } from '../browser-storage';
import { useMoodSocket } from './use-mood-socket';

const NOTICES: Partial<Record<ErrorReason, string>> = {
  SESSION_FULL: 'This session is full, so your mood could not be added.',
  FORBIDDEN: 'Only the person who started the session can do that.',
  INTERNAL: 'Something went wrong. Please try again.',
  INVALID_MESSAGE: 'Something went wrong. Please try again.',
};

export interface MoodSession {
  snapshot: SessionSnapshot | null;
  /** The mood this browser chose, or null until the swing is moved. */
  myMood: number | null;
  notFound: boolean;
  notice: string | null;
  isCreator: boolean;
  vote: (mood: number) => void;
  endSession: () => void;
  soothe: () => void;
  restartSession: () => void;
  dismissNotice: () => void;
}

/** Joins a session over the shared socket, re-joining (and re-voting) after every reconnect. */
export function useMoodSession(code: string): MoodSession {
  const socket = useMoodSocket();
  const voterId = useMemo(getVoterId, []);
  const creatorToken = useMemo(() => getCreatorToken(code), [code]);
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [myMood, setMyMood] = useState<number | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const myMoodRef = useRef<number | null>(null);
  const roundRef = useRef<number | null>(null);

  useEffect(() => {
    const join = () => socket.send({ action: 'join', code, voterId });
    const stopOpen = socket.onOpen(join);
    // The creator restarting the session starts a new round where nobody has a mood yet.
    const enterRound = (round: number) => {
      if (roundRef.current !== null && roundRef.current !== round) {
        myMoodRef.current = null;
        setMyMood(null);
      }

      roundRef.current = round;
    };
    const stopMessages = socket.onMessage((message) => {
      switch (message.type) {
        case 'joined':
          if (message.code !== code) {
            return;
          }

          setNotFound(false);
          enterRound(message.round);

          if (myMoodRef.current === null) {
            myMoodRef.current = message.yourMood;
            setMyMood(message.yourMood);
          } else if (myMoodRef.current !== message.yourMood) {
            // A vote made while offline never arrived; send it again.
            socket.send({ action: 'vote', code, voterId, mood: myMoodRef.current });
          }
          return;
        case 'snapshot':
          if (message.snapshot.code === code) {
            enterRound(message.snapshot.round);
            setSnapshot(message.snapshot);
          }
          return;
        case 'error':
          if (message.code !== undefined && message.code !== code) {
            return;
          }

          if (message.reason === 'SESSION_NOT_FOUND') {
            setNotFound(true);
          } else if (message.reason !== 'SESSION_CLOSED') {
            // A late vote on a closed session needs no notice: the summary says it all.
            setNotice(NOTICES[message.reason] ?? null);
          }
          return;
        default:
          return;
      }
    });

    if (socket.getStatus() === 'live') {
      join();
    }

    return () => {
      stopOpen();
      stopMessages();
    };
  }, [socket, code, voterId]);

  const vote = useCallback(
    (mood: number) => {
      myMoodRef.current = mood;
      setMyMood(mood);
      socket.send({ action: 'vote', code, voterId, mood });
    },
    [socket, code, voterId],
  );

  const sendAsCreator = useCallback(
    (action: 'endSession' | 'soothe' | 'restartSession') => {
      if (creatorToken) {
        socket.send({ action, code, creatorToken });
      }
    },
    [socket, code, creatorToken],
  );
  const endSession = useCallback(() => sendAsCreator('endSession'), [sendAsCreator]);
  const soothe = useCallback(() => sendAsCreator('soothe'), [sendAsCreator]);
  const restartSession = useCallback(() => sendAsCreator('restartSession'), [sendAsCreator]);

  const dismissNotice = useCallback(() => setNotice(null), []);

  return {
    snapshot,
    myMood,
    notFound,
    notice,
    isCreator: creatorToken !== null,
    vote,
    endSession,
    soothe,
    restartSession,
    dismissNotice,
  };
}
