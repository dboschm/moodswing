import { useRef } from 'react';
import { averageMood } from '../../shared/mood';
import { AppShell } from '../components/app-shell';
import { GhostSwing, MoodArc } from '../components/mood-arc';
import { MoodScene } from '../components/mood-scene';
import { MoodSummary } from '../components/mood-summary';
import { SessionHeader } from '../components/session-header';
import { Swing } from '../components/swing';
import { copyText } from '../browser-clipboard';
import { useMoodSession } from '../hooks/use-mood-session';
import { SOOTHED_MOOD, useSoothing } from '../hooks/use-soothing';
import { sessionUrl } from '../session-route';
import { SOOTHING_SPRING } from '../swing-physics';

const NO_MOODS: readonly number[] = [];

interface SessionScreenProps {
  code: string;
  onNavigate: (path: string) => void;
}

export function SessionScreen({ code, onNavigate }: SessionScreenProps) {
  const session = useMoodSession(code);
  const { snapshot, myMood } = session;
  const closed = snapshot?.status === 'closed';
  const moods = snapshot?.moods ?? NO_MOODS;
  // Once the creator soothes, every mood on every screen swings into Content; the results stay as voted.
  const soothing = snapshot?.soothedAt !== undefined;
  const arrivalRef = useRef<{ round: number; soothed: boolean } | null>(null);

  if (snapshot && arrivalRef.current === null) {
    arrivalRef.current = { round: snapshot.round, soothed: soothing };
  }

  // Opening a session that was soothed before you arrived shows everyone at rest straight away.
  const soothedOnArrival = arrivalRef.current?.soothed === true && arrivalRef.current.round === snapshot?.round;
  const shown = useSoothing(moods, soothing, soothedOnArrival);
  const average = averageMood(shown.moods);
  const goHome = () => onNavigate('/');

  if (session.notFound) {
    return (
      <AppShell>
        <section className="not-found">
          <h2>Session {code} isn't here</h2>
          <p>It may have expired (sessions last 24 hours) or the code has a typo.</p>
          <button type="button" className="button" onClick={goHome}>
            Back to the start
          </button>
        </section>
      </AppShell>
    );
  }

  const note =
    !closed && myMood === null
      ? 'Drag the swing or use the arrow keys to share your mood. Nobody can see who picked what.'
      : undefined;

  return (
    <AppShell
      header={
        <SessionHeader
          code={code}
          snapshot={snapshot}
          isCreator={session.isCreator}
          onCopyLink={() => copyText(sessionUrl(code))}
          onEndSession={session.endSession}
        />
      }
    >
      <MoodScene label={`Mood swing for session ${code}`} note={note}>
        <MoodArc moods={shown.moods} ringsFrom={moods} />
        {average !== null && <GhostSwing mood={average} />}
        <Swing
          mood={soothing ? SOOTHED_MOOD : myMood}
          spring={soothing && !soothedOnArrival ? SOOTHING_SPRING : undefined}
          onCommit={session.vote}
          disabled={closed}
        />
      </MoodScene>

      {closed && snapshot && (
        <MoodSummary
          snapshot={snapshot}
          isCreator={session.isCreator}
          soothing={soothing}
          soothed={soothing && shown.settled}
          onCopySummary={copyText}
          onSoothe={session.soothe}
          onRestart={session.restartSession}
        />
      )}

      {session.notice && (
        <div className="toast" role="status">
          <span>{session.notice}</span>
          <button type="button" className="toast__close" onClick={session.dismissNotice} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
    </AppShell>
  );
}
