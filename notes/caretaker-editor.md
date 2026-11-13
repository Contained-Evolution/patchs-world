# Shared world editor v1

The caretaker menu's **Edit World** opens `/editor.html` in Patch’s World. Only the existing administrator account can read or modify drafts, upload models, or publish. Tenari keeps its **World editor** entry at `/world/valley.html` and scopes all editor data and uploads to the signed-in companion owner.

The editor uses the actual island/valley scenery. Ordinary generated trees and decorative boulders have stable `base:` records and remain instanced. Activity fixtures, banana/swing trees and their supports, cave structure, terrain, water and Tenari town landmarks remain protected. New architecture can be made from blocks/platforms or static GLB models. Added models are decorative; they do not acquire activities automatically.

## Controls

- Drag empty space to orbit; **Pan camera** changes one-finger/left-mouse navigation to pan. Two fingers pan and pinch to zoom. The compact XYZ widget aligns the view when an axis is clicked and orbits when dragged. Selecting a model sets the orbit pivot to its centre; Frame selection (F) fits it in view. Right-drag pans with a mouse; its wheel zooms.
- Select a model or use the object list. Move/Rotate/Scale handles and numeric XYZ fields support free 3D transforms. Desktop shortcuts: W/E/R, F, Delete, Ctrl/Command-Z, Shift-Ctrl/Command-Z.
- The flat reference grid starts at world Y=0. Change Grid height or use Grid to Selection. Axes are X/red, Y/green/up and Z/blue. Terrain cutaway reveals below-ground objects. Grid visibility and snapping are independent. Drop to Ground accounts for the object's transformed lower bound.
- Duplicate, Delete, Undo and Redo change the draft. GLB upload previews dimensions and the model pivot, with metres/centimetres/millimetres source units. Uploads must be self-contained static GLB 2 models, at most 25 MiB and one million vertices. Unsupported required compression extensions and external resources are rejected.
- Tenari retains walkway painting as a separate tool. Select its material, then tap ground to paint cells; use Erase to remove cells. Object placement itself is not constrained to these cells.

## Data and publishing

`GET /api/editor/published` returns a complete `{revision, layout}`. Layout v1 contains `objects` with stable IDs, asset references, positions, Euler rotations in radians, scales, and `walkways`. Removed built-ins use tombstones; unchanged built-ins remain implicit. Built-in baseline metadata is exported for server-side authorization and bounds validation.

Owner endpoints: `GET/PUT /api/editor/draft`, `POST /api/editor/publish`, `POST /api/editor/rollback`, `GET/POST /api/editor/uploads`, and `GET /api/editor/assets/:id`. Tenari prefixes these with `/world`. Draft writes require the current draft revision; publish also checks the published base revision. Concurrent edits return 409 rather than overwriting. Mutations require the same origin. Upload object keys include the owner world.

Drafts autosave after completed edits. Failed saves retain device recovery data and allow JSON export. Publishing validates asset ownership, transforms and activity clearance, then atomically promotes the entire draft. More → Revert published world swaps the prior published snapshot back into service and replaces the draft. More also holds Download draft backup and Hide overlays; the latter hides the grid, gizmos and inspector for a clear view of the same draft. Visitors poll every 15 seconds, apply complete revisions, and retain the last working scene if an asset fails to load. Rendering and collision use the same transformed object records. Collision is a conservative bounding-box approximation with a spatial index, not triangle-level rigid-body physics.

Tenari migrates existing scenery at its original position, seeded yaw and scale, retaining walkways. Its old layout PUT endpoint returns 410 so cached versions cannot bypass private drafts. Original scenery is grandfathered through new publish clearance checks until moved. The companion planner receives the published obstacle boxes too.

## Package maintenance and deployment

The common frontend, layout/store/GLB/collision modules, API handler and CSS are a vendored `@contained-evolution/world-editor` v1.0.0 package. `shared/editor/package-lock.json` pins hashes; both builds verify them. World adapters, baseline and catalog metadata remain repository-specific.

After a shared change in the canonical checkout:

```
node tools/editor-package.mjs --lock
```

Then in the other checkout:

```
node tools/editor-package.mjs --source /path/to/canonical-checkout
```

After changing built-in scenery or asset files, regenerate metadata from each repository root:

```
node tools/editor-baseline.mjs
node tools/editor-catalog.mjs
```

Baseline IDs must remain stable when changing generation order; migrate saved overrides before shipping incompatible generation changes. Do not regenerate IDs casually.

Both Workers require an `EDITOR_ASSETS` R2 binding. Wrangler configuration names the buckets `patchs-world-editor-assets` and `tenari-world-editor-assets`; provision them in the appropriate Cloudflare account before deployment. No API key belongs in client code. SQLite Durable Object storage keeps private drafts, published/previous revisions and upload metadata independently of the companion's body state. Uploaded bytes live in R2. No new Durable Object class migration is required.

Before rollout, run both viewer and worker test suites, both viewer builds, and worker bundling/dry-run validation. Verify a signed-in draft stays private, publish a small reversible edit, check a signed-out viewer and walking collision, then restore the previous layout. This implementation does not deploy or provision production infrastructure automatically.
