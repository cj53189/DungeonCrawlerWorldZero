# Next Codex Prompt: Wire Tiny Dungeon Tiles Into Renderer

Implement a small, safe Tiny Dungeon tile preview/loader using the added Kenney Tiny Dungeon assets.

Assets:
- `assets/tilesets/kenney/tiny-dungeon/Tilemap/tilemap.png`
- `assets/tilesets/kenney/tiny-dungeon/Tilemap/tilemap_packed.png`

Requirements:
1. Do not replace the current dungeon renderer globally yet.
2. Add a tiny tileset loader/manifest helper that can load the Kenney Tiny Dungeon tilemap.
3. Treat tiles as 16×16 source tiles with 1px spacing in the standard tilemap.
4. Draw at 2x scale for the current 32px game tile size.
5. Ensure `ctx.imageSmoothingEnabled = false` anywhere this tilesheet is drawn.
6. Add a dev/debug preview path or isolated helper first, not a full art-direction swap.
7. Keep the current player character creator unchanged.
8. Do not use the uploaded roguelike character atlas or male-base JPEG until license/source is confirmed.

Suggested commit:
`Add Tiny Dungeon tileset loader preview`
