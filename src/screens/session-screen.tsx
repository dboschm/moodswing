import { averageMood } from '../../shared/mood';
import { AppShell } from '../components/app-shell';
import { ClosedSign, GhostSwing, MoodArc } from '../components/mood-arc';
import { MoodScene } from '../components/mood-scene';
import { MoodSummary } from '../components/mood-summary';
import { Swing } from '../components/swing';
import { TeamPanel } from '../components/team-panel';
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
  const { snapshot } = session;
  const closed = snapshot?.status === 'closed';
  const average = snapshot ? averageMood(snapshot.moods) : null;
  const goHome = () => onNavigate('/');

  if (session.notFound) {
    return (
      <AppShell onHome={goHome}>
        <section className="card not-found">
          <h2>Session {code} isn't here</h2>
          <p>It may have expired (sessions last 24 hours) or the code has a typo.</p>
          <button type="button" className="button" onClick={goHome}>
            Back to the start
          </button>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell onHome={goHome}>
      <div className="layout">
        <MoodScene
          label={`Mood swing for session ${code}`}
          caption={closed ? 'How the team really felt' : 'How the team really feels'}
        >
          {closed && <ClosedSign />}
          <MoodArc moods={snapshot?.moods ?? []} />
          {average !== null && <GhostSwing mood={average} />}
          <Swing mood={session.myMood} onCommit={session.vote} disabled={closed} />
        </MoodScene>

        {closed && snapshot ? (
          <MoodSummary snapshot={snapshot} creating={creating} onCopySummary={copyText} onStartNew={create} />
        ) : (
          <TeamPanel
            code={code}
            snapshot={snapshot}
            myMood={session.myMood}
            isCreator={session.isCreator}
            status={status}
            onCopyLink={() => copyText(sessionUrl(code))}
            onEndSession={session.endSession}
          />
        )}
      </div>

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
