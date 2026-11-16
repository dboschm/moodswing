# Agent guide

## Layout

- `src/` React client
  - `screens/`: one component per route (`/` home, `/MS-XXXXXX` session)
  - `components/`: SVG scene pieces and panels. They render props; hooks own sockets and browser APIs.
  - `hooks/`: socket context, session state, swing drag/physics, session creation
  - root files: pure logic (`swing-physics.ts`, `face-geometry.ts`) and small browser adapters (`browser-storage.ts`, `browser-clipboard.ts`, `config.ts`)
- `shared/`: imported by both client and Lambda. `protocol.ts` is the wire contract and `mood.ts` the mood scale. No DOM or Node APIs here.
- `backend/`: `session-service.ts` holds the rules behind `SessionStore`/`Broadcaster` interfaces. `handler.ts` adapts API Gateway events, `dynamo-session-store.ts` is the table access, and `dev/vite-dev-backend.ts` runs the same service in-memory under `npm run dev`.
- `cdk/`: separate npm package with the single `MoodswingStack`.

## Commands

| What | Command |
| --- | --- |
| Dev server with in-memory backend | `npm run dev` |
| Tests (root) | `npm test` |
| Type-check + build | `npm run build` |
| CDK tests | `cd cdk && npm test` |
| Synth / deploy | `cd cdk && npx cdk synth` / `npx cdk deploy` |

Use Node 24 (`.nvmrc`).

## Conventions

- File names are kebab-case and lowercase, including CSS.
- Specs are colocated as `*.spec.ts(x)`. Component specs opt into jsdom with `// @vitest-environment jsdom`.
- Two-space indent, single quotes, semicolons.
- Every client message is validated by `parseClientMessage` before the service sees it. Add new actions there, in `SessionService.handleMessage`, and as a route in `cdk/lib/moodswing-stack.ts`.
- Votes stay anonymous: never send `voterId`s or per-voter data to clients.
- Scene coordinates live in `src/components/scene-geometry.ts`. Swing direction is `LAUGHING_SIDE` in `shared/mood.ts`.
- Commits follow Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`).
