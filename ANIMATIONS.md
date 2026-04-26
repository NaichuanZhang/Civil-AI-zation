# Animation Assets

This directory contains animated GIF sprites for the warrior cat character.

## Generated Animations

All animations were generated using `sprite_animator.py` with the following specifications:

### Rest Animation (`rest_256x256.gif`)
- **Source**: `assets/rest.png` (frames 1-10)
- **Size**: 256×256 pixels
- **Frames**: 18 (10 forward + 8 backward via palindrome)
- **FPS**: 5 (200ms per frame)
- **Duration**: 3.6 seconds per loop
- **Background**: Auto-detected (0xF5FEF2) - removed (transparent)
- **Features**: Palindrome animation for smooth looping

**Command:**
```bash
cd scripts
python3 sprite_animator.py ../assets/rest.png --first-frame 1 --last-frame 10 --auto-background --palindrome --fps 5 --output ../assets/rest_256x256.gif
```

### Move Animation (`move_256x256.gif`)
- **Source**: `assets/move.png` (frames 1-10)
- **Size**: 256×256 pixels
- **Frames**: 18 (10 forward + 8 backward via palindrome)
- **FPS**: 5 (200ms per frame)
- **Duration**: 3.6 seconds per loop
- **Background**: Auto-detected (0xF2FEEE) - removed (transparent)
- **Features**: Palindrome animation for smooth walking cycle

**Command:**
```bash
cd scripts
python3 sprite_animator.py ../assets/move.png --first-frame 1 --last-frame 10 --auto-background --palindrome --fps 5 --output ../assets/move_256x256.gif
```

### Attack Animation (`attack_256x256.gif`)
- **Source**: `assets/attack.png` (frames 1-10)
- **Size**: 256×256 pixels
- **Frames**: 10 (linear, no palindrome)
- **FPS**: 10 (100ms per frame)
- **Duration**: 1.0 second
- **Background**: Auto-detected (0xF5FEF2) - removed (transparent)
- **Features**: Fast one-shot animation

**Command:**
```bash
cd scripts
python3 sprite_animator.py ../assets/attack.png --first-frame 1 --last-frame 10 --auto-background --fps 10 --output ../assets/attack_256x256.gif
```

## Animation States

The game uses these animations in different contexts:

| State | Animation | Trigger |
|-------|-----------|---------|
| Idle | `rest_256x256.gif` | No movement keys pressed |
| Walking | `move_256x256.gif` | WASD keys pressed |
| Attacking | `attack_256x256.gif` | SPACE key pressed |

## Technical Details

### Palindrome Animation
The rest and move animations use palindrome mode, which creates a smooth loop:
- Original frames: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
- Palindrome adds: 9, 8, 7, 6, 5, 4, 3, 2
- Total: 18 frames (first and last frame appear only once)
- Creates seamless forward-backward motion

### Auto-Background Detection
All animations use `--auto-background` to detect and remove the sprite sheet background:
- Samples pixel at position (0, 0) from the sprite sheet
- Removes that color and makes it transparent
- Additionally removes high green pixels (G > R+20 and G > B+20 and G > 200) to eliminate sprite sheet artifacts
- Results in clean sprites with no colored boundaries

### Frame Selection
All animations use the first 10 frames from their 4×4 sprite sheets:
- Frame range: 1-10 (excludes frames 11-16)
- Provides sufficient motion without redundancy
- Keeps file sizes reasonable (480-880 KB)

## File Sizes

| File | Size | Frames | Duration |
|------|------|--------|----------|
| `rest_256x256.gif` | 184 KB | 18 | 3.6s |
| `move_256x256.gif` | 183 KB | 18 | 3.6s |
| `attack_256x256.gif` | 92 KB | 10 | 1.0s |

## Regenerating Animations

To regenerate any animation:

1. Ensure you have the original sprite sheet (`rest.png`, `move.png`, or `attack.png`)
2. Run the corresponding command above
3. Replace the existing GIF in the `assets/` directory

## sprite_animator.py Features Used

- `--first-frame` / `--last-frame`: Select specific frame range
- `--palindrome`: Create forward-backward animation
- `--auto-background`: Preserve original background color
- `--fps`: Control animation speed
- `--size`: Output sprite dimensions (default 256×256)

## Usage in Game

See `../scripts/player-movement-test/index.html` for implementation details.

The game loads all three animations and switches between them based on player input:
- Idle → rest
- Moving → move  
- Attacking → attack (locks movement for 1 second)
