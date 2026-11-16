import { useCallback, useEffect, useState } from 'react';
import { HomeScreen } from './screens/home-screen';
import { SessionScreen } from './screens/session-screen';
import { sessionCodeFromPath } from './session-route';
import './app.css';

export function App() {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((to: string) => {
    if (to !== window.location.pathname) {
      window.history.pushState(null, '', to);
    }

    setPath(to);
    window.scrollTo({ top: 0 });
  }, []);

  const code = sessionCodeFromPath(path);

  return code ? <SessionScreen key={code} code={code} onNavigate={navigate} /> : <HomeScreen onNavigate={navigate} />;
}
