# Rules

- Everything for Patch lives in this folder. A session working while another is already here uses a worktree under `.worktrees/` (`git worktree add .worktrees/<name> -b <branch>`), never a sibling folder.
- When the work is done and pushed, remove the worktree (`git worktree remove .worktrees/<name>`), delete its merged branch, and delete any scratch files the session made.
- Test screenshots, smoke scripts and PR drafts go in your scratch or temp directory, never in this folder or the home folder.
- `art/animations/` holds the character source and Mixamo clips that [tools/combine-patch.py](tools/combine-patch.py) builds into [world/assets/patch.glb](world/assets/patch.glb). Git ignores the raw animation files because Mixamo's terms don't allow redistributing them. `art/world/` holds local scenery source files.
