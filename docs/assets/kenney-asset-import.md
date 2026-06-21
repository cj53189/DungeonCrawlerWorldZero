# Kenney Tiny Dungeon Asset Import

This commit adds the runtime-safe core of Kenney Tiny Dungeon 1.0 for Dungeon Crawler World Zero.

## What was added

- `assets/tilesets/kenney/tiny-dungeon/Tilemap/tilemap.png`
- `assets/tilesets/kenney/tiny-dungeon/Tilemap/tilemap_packed.png`
- `assets/tilesets/kenney/tiny-dungeon/License.txt`
- `assets/tilesets/kenney/tiny-dungeon/Tilesheet.txt`
- `assets/tilesets/kenney/tiny-dungeon/Tiled/sampleSheet.tsx`
- `assets/asset-manifest.kenney.json`

## Why this pack

Kenney Tiny Dungeon is a small 16×16 dungeon tile set that fits the current top-down direction much better than the isometric miniature pack. The game currently uses a 32px tile size, so these tiles should be drawn at 2x scale with `imageSmoothingEnabled = false`.

## License

Kenney Tiny Dungeon is CC0. Credit to Kenney is encouraged, but not required. The original license text is preserved in the asset folder.

## Not added yet

The user-uploaded roguelike character atlas and male-base JPEG were intentionally left out of production assets until their source/license is verified. Use them as visual references only for now.

The full set of individually sliced 16×16 tiles is not added in this first pass. The tilemap PNGs contain the usable runtime sheet; individual tiles can be added later if we decide we need file-by-file references.
