import type { ReactNode } from 'react';
import { Logo } from './logo';
import { TitleCell } from './title-cell';

interface AppShellProps {
  /** Further title block cells after the app name. */
  header?: ReactNode;
  children: ReactNode;
}

/** The page as one drawing sheet: a title block across the top and the content below it. */
export function AppShell({ header, children }: AppShellProps) {
  return (
    <div className="app">
      <div className="sheet">
        <header className="title-block">
          <TitleCell className="title-cell--name">
            <h1>
              <Logo />
            </h1>
          </TitleCell>
          {header}
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
