const VOTER_ID_KEY = 'moodswing:voter-id';
const creatorTokenKey = (code: string) => `moodswing:creator:${code}`;

let memoryVoterId: string | undefined;

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the value just won't survive a reload.
  }
}

/** crypto.randomUUID needs a secure context, which a LAN dev server isn't. */
function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** An anonymous id per browser so people can change their mood instead of voting twice. */
export function getVoterId(): string {
  const stored = read(VOTER_ID_KEY);

  if (stored) {
    return stored;
  }

  memoryVoterId ??= randomId();
  write(VOTER_ID_KEY, memoryVoterId);
  return memoryVoterId;
}

export function getCreatorToken(code: string): string | null {
  return read(creatorTokenKey(code));
}

export function saveCreatorToken(code: string, token: string): void {
  write(creatorTokenKey(code), token);
}
