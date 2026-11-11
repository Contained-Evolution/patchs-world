# Technical specifications

- Runtime: Cloudflare Worker `patchs-world`, entry [worker/index.mjs](worker/index.mjs), config [worker/wrangler.toml](worker/wrangler.toml).
- Routes: none of its own. Tenari's Worker forwards `tenari.world/patch*` to it through a service binding.
- Service bindings: `AUTH_SERVICE` → `ce-auth-candidate`. [accounts.mjs](worker/accounts.mjs) reads Tenari's session cookie and checks it there; sign-in is `/auth/start?next=patch%2F`.
- Storage: one SQLite-backed Durable Object, `PatchWorld`, keyed `patch`. It holds Patch's body under `body`.
- Body: [worker/body.mjs](worker/body.mjs). It steps from activity to activity when state is read, so it needs no timer. His day follows New York time.
- Mind: [worker/mind.mjs](worker/mind.mjs), [persona](worker/persona.mjs). A Durable Object alarm wakes it every 30–60 minutes while he's awake, and the evening wake also writes his diary. It calls OpenRouter (`OPENROUTER_API_KEY` secret) with a main and a backup model per tier, only on hosts that don't keep prompts, and stops at $24 a month.
- Memory: childhood memories in [worker/seed/childhood.json](worker/seed/childhood.json); island memories, categories, thoughts, words and diary entries in the Durable Object. Shape: [shared/memory.js](shared/memory.js).
- API: `GET /patch/api/state` returns the shape in [shared/state.js](shared/state.js). `GET /patch/api/journal` returns recent thoughts, diary entries, learned words and spend. `GET /patch/api/memory` returns categories and all memories.
- Letters and message board: [letters.mjs](worker/letters.mjs) holds the limits. `GET /patch/api/me`; `GET`/`POST /patch/api/letters` and `POST /patch/api/board` need an account; `GET /patch/api/board?before=` is public; `POST /patch/api/board/<id>/report` and `/block`. Posts and letters pass the automatic filter in [mind.mjs](worker/mind.mjs) first. POSTs must come from `https://tenari.world`.
- Viewer: [world/src/terrain.js](world/src/terrain.js) defines the shared island heights, coast, places and routes. [world/src/visitor-controls.js](world/src/visitor-controls.js) controls independent walking and flight. [world/src/community.js](world/src/community.js) connects the letters and board panels to the visitor API.
- Static assets: `world/dist`, served under `/patch/`. [prepare.mjs](worker/scripts/prepare.mjs) builds the world if present and adds the Pangolin font (OFL).
- Tests: `npm test` in `worker/`. Deploy: `npm run deploy` in `worker/`. If a new Durable Object method answers "RPC receiver does not implement the method" after a deploy, deploy again.
