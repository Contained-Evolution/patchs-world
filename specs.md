# Technical specifications

- Runtime: Cloudflare Worker `patchs-world`, entry [worker/index.mjs](worker/index.mjs), config [worker/wrangler.toml](worker/wrangler.toml).
- Routes: none of its own. Tenari's Worker forwards `tenari.world/patch*` to it through a service binding.
- Storage: one SQLite-backed Durable Object, `PatchWorld`, keyed `patch`. It holds Patch's body under `body`.
- Body: [worker/body.mjs](worker/body.mjs). It steps from activity to activity when state is read, so it needs no timer. His day follows New York time.
- Mind: [worker/mind.mjs](worker/mind.mjs), [persona](worker/persona.mjs). A Durable Object alarm wakes it every 30–60 minutes while he's awake, and the evening wake also writes his diary. It calls OpenRouter (`OPENROUTER_API_KEY` secret) with a main and a backup model per tier, only on hosts that don't keep prompts, and stops at $24 a month.
- Memory: childhood memories in [worker/seed/childhood.json](worker/seed/childhood.json); island memories, categories, thoughts, words and diary entries in the Durable Object. Shape: [shared/memory.js](shared/memory.js).
- API: `GET /patch/api/state` returns the shape in [shared/state.js](shared/state.js). `GET /patch/api/journal` returns recent thoughts, diary entries, learned words and spend. `GET /patch/api/memory` returns categories and all memories.
- Static assets: `world/dist`, served under `/patch/`. [prepare.mjs](worker/scripts/prepare.mjs) builds the world if present and adds the Pangolin font (OFL).
- Tests: `npm test` in `worker/`. Deploy: `npm run deploy` in `worker/`.
