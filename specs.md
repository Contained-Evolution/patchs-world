# Technical specifications

- Runtime: Cloudflare Worker `patchs-world`, entry [worker/index.mjs](worker/index.mjs), config [worker/wrangler.toml](worker/wrangler.toml).
- Routes: none of its own. Tenari's Worker forwards `tenari.world/patch*` to it through a service binding.
- Storage: one SQLite-backed Durable Object, `PatchWorld`, keyed `patch`. It holds Patch's body under `body`.
- Body: [worker/body.mjs](worker/body.mjs). It steps from activity to activity when state is read, so it needs no timer. His day follows New York time.
- API: `GET /patch/api/state` returns the shape in [shared/state.js](shared/state.js).
- Static assets: `world/dist`, served under `/patch/`. [prepare.mjs](worker/scripts/prepare.mjs) builds the world if present and adds the Pangolin font (OFL).
- Tests: `npm test` in `worker/`. Deploy: `npm run deploy` in `worker/`.
