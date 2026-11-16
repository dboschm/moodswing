import { isSessionCode } from '../shared/protocol';

/** Session pages live at `/MS-XXXXXX`; anything else is the home page. */
export function sessionCodeFromPath(pathname: string): string | null {
  const segment = pathname.replace(/^\/+|\/+$/g, '').toUpperCase();

  return isSessionCode(segment) ? segment : null;
}

export function sessionPath(code: string): string {
  return `/${code}`;
}

export function sessionUrl(code: string): string {
  return `${window.location.origin}${sessionPath(code)}`;
}
