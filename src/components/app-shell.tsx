import type { ReactNode } from 'react';
import { Logo } from './logo';

interface AppShellProps {
  /** Title block cells across the top of the sheet. */
  header?: ReactNode;
  children: ReactNode;
}

/** The wordmark above one drawing sheet: a title block across the top and the content below it. */
export function AppShell({ header, children }: AppShellProps) {
  return (
    <div className="app">
      <h1 className="app__logo">
        <Logo />
      </h1>
      <div className="sheet">
        {header && <header className="title-block">{header}</header>}
        <main>{children}</main>
      </div>
    </div>
  );
}
