# Rules

- Everything for Patch lives in this folder. Don't create git worktrees or sibling folders; switch branches here.
- Test screenshots, smoke scripts and PR drafts go in your scratch or temp directory, never in this folder or the home folder.
- `art/` holds the source model and Mixamo clips that [tools/combine-patch.py](tools/combine-patch.py) builds into [world/assets/patch.glb](world/assets/patch.glb). Git ignores it because Mixamo's terms don't allow redistributing the raw files.
