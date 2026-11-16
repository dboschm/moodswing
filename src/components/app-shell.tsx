import type { MouseEvent, ReactNode } from 'react';

interface AppShellProps {
  onHome: () => void;
  children: ReactNode;
}

export function AppShell({ onHome, children }: AppShellProps) {
  const goHome = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    onHome();
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          <a href="/" onClick={goHome}>
            Mood Swing <span className="app-header__version">(version 1.0)</span>
          </a>
        </h1>
        <p>How does your team really feel?</p>
      </header>
      <main>{children}</main>
    </div>
  );
}
