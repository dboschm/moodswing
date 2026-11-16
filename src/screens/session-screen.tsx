import { averageMood } from '../../shared/mood';
import { AppShell } from '../components/app-shell';
import { ClosedSign, GhostSwing, MoodArc } from '../components/mood-arc';
import { MoodScene } from '../components/mood-scene';
import { MoodSummary } from '../components/mood-summary';
import { SessionHeader } from '../components/session-header';
import { Swing } from '../components/swing';
import { copyText } from '../browser-clipboard';
import { useCreateSession } from '../hooks/use-create-session';
import { useMoodSession } from '../hooks/use-mood-session';
import { useConnectionStatus } from '../hooks/use-mood-socket';
import { sessionPath, sessionUrl } from '../session-route';

interface SessionScreenProps {
  code: string;
  onNavigate: (path: string) => void;
}

export function SessionScreen({ code, onNavigate }: SessionScreenProps) {
  const session = useMoodSession(code);
  const status = useConnectionStatus();
  const { create, creating } = useCreateSession((newCode) => onNavigate(sessionPath(newCode)));
  const { snapshot, myMood } = session;
  const closed = snapshot?.status === 'closed';
  const average = snapshot ? averageMood(snapshot.moods) : null;
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
          status={status}
          onCopyLink={() => copyText(sessionUrl(code))}
          onEndSession={session.endSession}
        />
      }
    >
      <MoodScene label={`Mood swing for session ${code}`} note={note}>
        {closed && <ClosedSign />}
        <MoodArc moods={snapshot?.moods ?? []} />
        {average !== null && <GhostSwing mood={average} />}
        <Swing mood={myMood} onCommit={session.vote} disabled={closed} />
      </MoodScene>

      {closed && snapshot && (
        <MoodSummary snapshot={snapshot} creating={creating} onCopySummary={copyText} onStartNew={create} />
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
