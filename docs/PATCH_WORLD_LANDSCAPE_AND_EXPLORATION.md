# Patch's World — Landscape & Visitor Exploration Handoff

**Status:** Design and implementation handoff for Codex; do not deploy directly.
**Site:** https://tenari.world/patch/
**Repo:** Contained-Evolution/patchs-world
**Goal:** Make Patch's island feel like a coherent, explorable natural world. Let visitors independently walk at eye level or fly freely above it. Patch remains an autonomous inhabitant; visitors never control him.

## Verified architecture (main branch inspected 2026-11-10)

- `world/src/main.js`: Three.js scene, OrbitControls, live polling, Patch GLB animations, weather/time, currently camera-following Patch. The end of `frame()` shifts the camera and `controls.target` toward Patch, which must be removed for free exploration.
- `world/src/island.js`: procedural terrain (mostly flat, one raised Gaussian lookout), ellipse shoreline, ocean, props, trees, pond, cave and camera-dependent occluder hiding.
- `world/src/world-state.js`: `places`, `paths`, `groundHeight`, `trees`, `anchorFor`, `walkRoute`, `swingRoute`, `swingLoop`. Preserve public interfaces where possible.
- `world/index.html` / `world/style.css`: full-screen viewer, island map, letters and message board panels.
- `worker/body.mjs`: separate autonomous behavior system, uses canonical place IDs. Do not change server simulation/state for this visual redesign.
- `world/package.json`: Three.js 0.187.0 with esbuild; `world/assets/patch.glb` is Patch's model.

## Experience and artistic direction

The island should feel like *Patch's home*, not an empty grassy disk or an oversized game map. Warm, lush, intimate tropical sanctuary with hand-crafted, painterly/stylized shapes, organic geography, inviting trails, and distinctive destinations. Keep a consistent art style and good legibility at both ground level and aerial distance. Preserve day/night, rain, sky and atmosphere; ocean should read as a continuous horizon.

Preserve all ten existing activity destinations, place IDs and initially their coordinates:
- `hammock`, `shelves`: intimate central home clearing, believable hammock area, worn ground, light props, softer canopy
- `banana-grove`: broad leaves, clustered palms, dense but navigable growth, fruit details
- `tall-trees`: towering canopy, trunks/roots/branches, visually meaningful swinging routes
- `pond`: carved basin, rock edge, reeds, stream and small waterfall; safe swim/fish region
- `beach`: curved sandy cove, gradual shallows, palms/driftwood/shells
- `tide-pools`: stepped rocky coastline with reflective small pools and a traversable approach
- `lookout`: highest sculpted ridge with a winding walkable trail and unobstructed panorama
- `meadow`: open grasses, flowers, stones and view of the sky
- `cave`: believable accessible rock-mouth, modest illuminated interior and solid ground

Use irregular coastline with coves, headlands, rock outcrops, and beaches; gently rolling interior; an elevated lookout ridge; natural paths through the forest; distinct vegetation density by biome. Distant island silhouettes are scenic only, not required to be reachable. Avoid adding areas without purpose.

## Visitor camera — top priority

Implement a separate `world/src/visitor-controls.js` (or similarly named module), decoupled from Patch's autonomous movement. Support:

### Walk mode
- First-person eye level (~1.6 scene units, tune to model scale), mouse-look with explicit click/pointer lock and Esc unlock.
- WASD/arrows locomotion relative to yaw, optionally Shift sprint. Smooth frame-rate-independent motion.
- Ground camera at `groundHeight(x,z) + eyeHeight` using the same height query as rendered terrain. Slope restrictions, basic trunk/rock collision and sliding, coast boundary so visitors cannot walk into open sea or fall through the world.
- Walkable route from home to every named location. No forced following, no snapping when Patch changes places.

### Fly mode
- Independent free camera, not orbit around Patch: WASD horizontal movement, mouse look, Space up, Ctrl/C down, Shift faster; clear on-screen help.
- Keep camera safely above terrain, clamp reasonable altitude and horizontal roaming area so the visitor does not disappear beyond the scene.
- **Overview** moves camera to an island-framing aerial vantage but stays freely navigable. It is a preset, not an orbit lock.
- **Find Patch** explicitly repositions/orients camera toward Patch safely; return control to visitor immediately. Never continuously recenter after the command.

### Mode behavior and UI
- Clearly visible `Walk`, `Fly`, `Find Patch`, `Overview`, `Island Map` controls.
- Switching modes should preserve a sensible position/direction and prevent underground camera placement.
- Opening any overlay/dialog must release pointer lock and pause movement, keeping forms/letters/message board clickable. Mouse look must not steal UI clicks.
- On touch devices, provide usable left-side movement / right-side look and fly ascent/descent controls. If touch implementation must be a later milestone, retain a usable, clearly labeled fallback rather than broken pointer-lock-only navigation.
- Responsive placement, keyboard focus states, reduced-motion support, unobtrusive help text; preserve existing map/board/letters flows.
- API failure must not stop scenery exploration; indicate that Patch's live state is unavailable instead.

## Terrain implementation

Current ground is primarily a flat heightfield with one Gaussian hill. Replace with a deterministic continuous elevation function and irregular shore mask. Ground geometry, Patch positioning, routes, props and visitor grounding MUST all share one height implementation (e.g. `terrain.js` with `groundHeight` re-exported from `world-state.js`). Use smooth low-frequency noise / regional masks, not rough random spikes.

Protect local activity anchors with gentle flatter clearings and ensure all required trails have tolerable walking slopes. Build shoreline, wet sand and nearshore transition cleanly (no exposed oval base or z-fighting). Smoothly sample heights along route strips; paths should sit just above terrain. Validate cliffs/shore limits and cave entry. Deterministic foliage distribution with clearance zones for paths, spawn, landmarks, tree-swing movement, and Patch's actions. Use `InstancedMesh` where appropriate; avoid excessive transparency. Ground-level scene should have varied silhouettes and points of interest without cluttering travel.

The current `createIsland().update(camera, target)` hides trees obstructing Patch from orbit view. In first-person, do not make trees vanish merely because they block the line of sight to Patch. Restrict such visibility behavior to a deliberate view if truly necessary.

## Preserve Patch, not just the scenery

Keep the existing `patch.glb`, animations, body/action states, clipping logic, speech, API polling, day/night, rain and weather. Preserve canonical place identifiers, walking/swing transitions and anchor positions unless there is a thoroughly tested conversion. Do not change `worker/body.mjs`, authentication, Durable Object state, message board, or letters. Keep Patch independently animated when the visitor is far away. Avoid terrain/body intersections, floating feet, tree collisions during swinging and inaccessible fishing/swimming locations.

## Suggested implementation phases

1. **Camera decoupling PR**: create visitor controls, Walk/Fly/Overview/Find Patch, remove automatic follow, preserve existing island. Add desktop movement, pointer-lock release for UI, smoke checks.
2. **Terrain PR**: deterministic irregular island heightfield, shoreline, path alignment and walkability tests. Maintain place and route contracts.
3. **World dressing PR**: improve home, banana grove, tall trees, pond, beach, tide pools, lookout, meadow and cave; optimize draw calls and adjust foreground occlusion.
4. **Mobile and polish PR**: touch movement/look, accessibility, contextual labels, weather/ambient details, performance testing.

Codex should inspect current source first, articulate any changes to geometry/coordinates, implement incrementally on a feature branch, and create reviewable PRs. No production deployment without user approval.

## Definition of done

- Walk mode can reach all ten named places without falling through geometry, entering the ocean accidentally, or becoming trapped.
- Fly camera can move anywhere over the island freely and never follows Patch except by an explicit Find Patch command.
- Overview gives a useful aerial starting perspective without orbit tethering.
- Patch's actions, scene positions, walking/swinging animations and live status continue working.
- The ground/shore is naturally irregular, biome landmarks are distinguishable, and camp/pond/cave/lookout paths are coherent.
- Map, letter and board overlays work with mouse, keyboard and touch, without unintended movement.
- Weather and day/night still render well; visitor exploration works even if the state API cannot load.
- Desktop and mobile browser smoke checks, screenshot/recording evidence, performance notes.
- Build: `cd world && npm ci && npm run build`; regression tests: `cd worker && npm test` (plus any new terrain/controls tests).

## Codex starting instruction (copy/paste)

> Work in `Contained-Evolution/patchs-world`. Read `docs/PATCH_WORLD_LANDSCAPE_AND_EXPLORATION.md`. Start with Phase 1 only: independent visitor navigation (Walk/Fly/Overview/Find Patch), preserving Patch's simulation and scene behavior. Inspect the code, make a plan, implement in a new feature branch, run checks, and open a PR with a concise manual test checklist. Do not deploy. After Phase 1 is reviewed, proceed to the terrain and environment phases described in this design brief.
