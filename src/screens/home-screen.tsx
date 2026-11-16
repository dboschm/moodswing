import { useState, type FormEvent } from 'react';
import { normalizeSessionCode } from '../../shared/protocol';
import { AppShell } from '../components/app-shell';
import { MoodScene } from '../components/mood-scene';
import { Swing } from '../components/swing';
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
    <AppShell onHome={() => onNavigate('/')}>
      <div className="layout">
        <MoodScene label="Mood swing preview" caption="How your team really feels">
          <Swing mood={demoMood} onCommit={setDemoMood} label="Try the mood swing" />
        </MoodScene>

        <section className="card intro">
          <h2>A team mood meter you can swing</h2>
          <p>
            Start a session and share the link. Everyone pulls their own swing towards laughing or angry, and the whole
            team sees every mood live. Moods are anonymous. When you're done, end the session to see the results.
          </p>
          <button type="button" className="button button--large" onClick={create} disabled={creating}>
            {creating ? 'Starting…' : 'Start a mood session'}
          </button>
          {creating && status !== 'live' && <p className="hint">Connecting to the server…</p>}
          {failed && <p className="error">The session could not be started. Please try again.</p>}

          <form className="join-form" onSubmit={join} noValidate>
            <label htmlFor="session-code-input">Got a code from a teammate?</label>
            <div className="join-form__row">
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
            </div>
            {invalidCode && (
              <p id="session-code-error" className="error">
                That doesn't look like a session code. Codes look like MS-K7Q4XZ.
              </p>
            )}
          </form>
        </section>
      </div>
    </AppShell>
  );
}
