import { useState, type FormEvent } from 'react';
import { normalizeSessionCode } from '../../shared/protocol';
import { AppShell } from '../components/app-shell';
import { MoodScene } from '../components/mood-scene';
import { Swing } from '../components/swing';
import { TitleCell } from '../components/title-cell';
import { useCreateSession } from '../hooks/use-create-session';
import { useConnectionStatus } from '../hooks/use-mood-socket';
import { sessionPath } from '../session-route';

export function HomeScreen({ onNavigate }: { onNavigate: (path: string) => void }) {
  const status = useConnectionStatus();
  const { create, creating, failed } = useCreateSession((code) => onNavigate(sessionPath(code)));
  const [demoMood, setDemoMood] = useState<number | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [invalidCode, setInvalidCode] = useState(false);

  const join = (event: FormEvent) => {
    event.preventDefault();
    const code = normalizeSessionCode(codeInput);

    if (code) {
      onNavigate(sessionPath(code));
    } else {
      setInvalidCode(true);
    }
  };

  return (
    <AppShell
      header={
        <>
          <TitleCell label="New session">
            <button type="button" className="button" onClick={create} disabled={creating}>
              {creating ? 'Starting…' : 'Start a mood session'}
            </button>
            {creating && status !== 'live' && <span className="hint">Connecting to the server…</span>}
            {failed && <span className="error">Could not start the session. Please try again.</span>}
          </TitleCell>

          <TitleCell label="Got a code from a teammate?" labelFor="session-code-input">
            <form className="join-form" onSubmit={join} noValidate>
              <input
                id="session-code-input"
                value={codeInput}
                onChange={(event) => {
                  setCodeInput(event.target.value);
                  setInvalidCode(false);
                }}
                placeholder="MS-K7Q4XZ"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={invalidCode || undefined}
                aria-describedby={invalidCode ? 'session-code-error' : undefined}
              />
              <button type="submit" className="button button--secondary">
                Join
              </button>
            </form>
            {invalidCode && (
              <span id="session-code-error" className="error">
                Codes look like MS-K7Q4XZ.
              </span>
            )}
          </TitleCell>
        </>
      }
    >
      <MoodScene
        label="Mood swing preview"
        note="Start a session and share the link. Everyone swings towards laughing or angry and the whole team sees every mood live, anonymously. End the session to see the results."
      >
        <Swing mood={demoMood} onCommit={setDemoMood} label="Try the mood swing" />
      </MoodScene>
    </AppShell>
  );
}
