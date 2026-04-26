#!/usr/bin/env python3
"""
Sprite Sheet Animator - Convert 4x4 sprite sheets to animated GIFs

This script extracts individual sprites from a 4x4 grid sprite sheet,
resizes them, applies transparency, and creates an animated GIF.

Usage:
    python3 sprite_animator.py <input_file> [options]

Examples:
    # Basic usage with defaults (256x256, 5 FPS, transparent background)
    python3 sprite_animator.py standing.png

    # Custom size and FPS
    python3 sprite_animator.py standing.png --size 512 --fps 10

    # Keep specific background color (hex format)
    python3 sprite_animator.py standing.png --bg-color 0xF5EBD9

    # Exclude specific frames (1-indexed)
    python3 sprite_animator.py standing.png --exclude 10,11,12

    # Use specific frame range
    python3 sprite_animator.py standing.png --first-frame 1 --last-frame 8

    # Palindrome animation (forward then backward)
    python3 sprite_animator.py standing.png --palindrome --first-frame 1 --last-frame 5

    # All options combined
    python3 sprite_animator.py standing.png --size 128 --fps 8 --exclude 10,11,12 --output my_animation.gif

Arguments:
    input_file          Path to 4x4 sprite sheet image

Options:
    --size N            Output sprite size in pixels (default: 256)
                        Creates NxN square sprites

    --fps N             Animation frames per second (default: 5)
                        Higher = faster animation

    --exclude N,M,K     Comma-separated list of frames to exclude (1-indexed)
                        Example: --exclude 10,11,12
                        Default: 10,11,12

    --first-frame N     First frame to include (1-indexed, default: 1)
                        Used with --last-frame to specify frame range

    --last-frame N      Last frame to include (1-indexed, default: 16)
                        Used with --first-frame to specify frame range

    --palindrome        Create palindrome animation (forward then backward)
                        Example: frames 1,2,3,4,5 becomes 1,2,3,4,5,4,3,2
                        Note: First and last frames appear only once

    --bg-color 0xHHHHHH Background color in hex format (default: transparent)
                        Use 0xRRGGBB format (e.g., 0xFFFFFF for white)
                        If not specified, background becomes transparent

    --auto-background   Auto-detect background color from top-left corner pixel
                        and remove it (make transparent). Useful when background
                        color is unknown. Cannot be used with --bg-color

    --output FILE       Output GIF filename (default: auto-generated)
                        If not specified, uses input name + "_animated.gif"

    --tolerance N       Color matching tolerance for transparency (default: 30)
                        Higher = more aggressive transparency

    --help, -h          Show this help message

Configuration:
    SPRITE_SIZE         Output size for each sprite (default: 256x256)
    FPS                 Animation speed (default: 5)
    EXCLUDED_FRAMES     Frames to skip (default: [10, 11, 12])
    BG_COLOR            Background color or None for transparent (default: None)
    BG_TOLERANCE        Color matching tolerance (default: 30)

Output:
    - <output>.gif      Animated GIF with all frames
    - <output>_frames/  Directory containing individual PNG frames

Author: Claude
Version: 1.0
"""

from PIL import Image
import os
import sys
import argparse


class SpriteAnimator:
    """Convert 4x4 sprite sheets to animated GIFs with transparency"""

    def __init__(self, sprite_size=256, fps=5, excluded_frames=None,
                 bg_color=None, bg_tolerance=30, first_frame=None, last_frame=None,
                 palindrome=False, auto_background=False, remove_pad=0):
        """
        Initialize sprite animator

        Args:
            sprite_size (int): Output size for each sprite (creates square sprites)
            fps (int): Frames per second for animation
            excluded_frames (list): List of frame indices to exclude (1-indexed)
            bg_color (tuple): RGB background color (R, G, B) or None for transparent
            bg_tolerance (int): Color matching tolerance for transparency (0-255)
            first_frame (int): First frame to include (1-indexed)
            last_frame (int): Last frame to include (1-indexed)
            palindrome (bool): Create palindrome animation (forward then backward)
            auto_background (bool): Auto-detect and keep background color from top-left
            remove_pad (int): Number of pixels to crop from each boundary (0 = no cropping)
        """
        self.sprite_size = sprite_size
        self.fps = fps
        self.frame_duration = int(1000 / fps)  # Convert to milliseconds
        self.excluded_frames = set(excluded_frames or [10, 11, 12])
        # Convert 1-indexed to 0-indexed
        self.excluded_frames = {f - 1 for f in self.excluded_frames}
        self.bg_color = bg_color
        self.bg_tolerance = bg_tolerance
        self.first_frame = first_frame
        self.last_frame = last_frame
        self.palindrome = palindrome
        self.auto_background = auto_background
        self.remove_pad = remove_pad

    def hex_to_rgb(self, hex_color):
        """
        Convert hex color to RGB tuple

        Args:
            hex_color (str or int): Color in 0xRRGGBB format

        Returns:
            tuple: (R, G, B) values
        """
        if isinstance(hex_color, str):
            hex_color = int(hex_color, 16)
        r = (hex_color >> 16) & 0xFF
        g = (hex_color >> 8) & 0xFF
        b = hex_color & 0xFF
        return (r, g, b)

    def make_transparent(self, img, bg_color=None):
        """
        Convert background color to transparent

        Args:
            img (PIL.Image): Input image
            bg_color (tuple): Background RGB color to replace, or None to auto-detect

        Returns:
            PIL.Image: Image with transparent background
        """
        img = img.convert("RGBA")

        # Auto-detect background from top-left corner if not provided
        if bg_color is None:
            bg_color = img.getpixel((0, 0))[:3]

        data = img.getdata()
        new_data = []

        for item in data:
            r, g, b = item[:3]

            # Check if pixel is close to background color
            if all(abs(item[i] - bg_color[i]) <= self.bg_tolerance for i in range(3)):
                new_data.append((255, 255, 255, 0))  # Transparent
            # Preserve dark pixels (outlines, shadows) - don't filter if essentially black
            elif max(r, g, b) < 40:
                new_data.append(item)  # Keep original (dark pixel)
            # Aggressive green filter: remove greenish pixels (sprite sheet artifacts)
            # Filter: (167,248,128), (157,219,58), (221,253,208), (178,249,151)
            # Keep: (205,205,202), (234,208,164), (244,237,228)
            # Condition: Green is dominant AND significantly higher (>30) than at least one channel
            elif g > r and g > b and g - min(r, b) > 30:
                new_data.append((255, 255, 255, 0))  # Transparent
            else:
                new_data.append(item)  # Keep original

        img.putdata(new_data)
        return img

    def extract_sprites(self, sprite_sheet_path):
        """
        Extract individual sprites from 4x4 grid

        Args:
            sprite_sheet_path (str): Path to sprite sheet image

        Returns:
            list: List of PIL.Image objects for each sprite
        """
        img = Image.open(sprite_sheet_path)
        original_size = img.size[0]  # Assumes square sprite sheet
        sprite_size_orig = original_size // 4

        print(f"Loading sprite sheet: {sprite_sheet_path}")
        print(f"  Original size: {img.size[0]}×{img.size[1]}")
        print(f"  Original sprite size: {sprite_size_orig}×{sprite_size_orig}")
        print(f"  Target sprite size: {self.sprite_size}×{self.sprite_size}")

        all_frames = []

        # Extract all frames from sprite sheet
        for row in range(4):
            for col in range(4):
                frame_num = row * 4 + col

                # Extract sprite
                left = col * sprite_size_orig
                top = row * sprite_size_orig
                right = left + sprite_size_orig
                bottom = top + sprite_size_orig

                sprite = img.crop((left, top, right, bottom))

                # Apply padding removal if specified
                if self.remove_pad > 0:
                    pad = self.remove_pad
                    sprite_width, sprite_height = sprite.size
                    sprite = sprite.crop((pad, pad, sprite_width - pad, sprite_height - pad))

                # Resize to target size
                sprite_resized = sprite.resize(
                    (self.sprite_size, self.sprite_size),
                    Image.Resampling.LANCZOS
                )

                # Apply transparency
                if self.bg_color is None:
                    # Auto-detect from first frame or default to corner detection
                    sprite_resized = self.make_transparent(sprite_resized)

                all_frames.append(sprite_resized)

        # Apply frame range filter if specified
        if self.first_frame is not None or self.last_frame is not None:
            first = (self.first_frame or 1) - 1  # Convert to 0-indexed
            last = (self.last_frame or 16) - 1   # Convert to 0-indexed
            selected_frames = all_frames[first:last + 1]
            print(f"  Selected frames {first + 1} to {last + 1}")
        else:
            # Use excluded_frames logic
            selected_frames = []
            excluded_count = 0
            for frame_num, frame in enumerate(all_frames):
                if frame_num in self.excluded_frames:
                    print(f"  Skipping frame {frame_num + 1} (1-indexed)")
                    excluded_count += 1
                    continue
                selected_frames.append(frame)
            print(f"  Extracted {len(selected_frames)} frames (excluded {excluded_count})")

        # Apply palindrome if requested
        if self.palindrome:
            # Create palindrome: 1,2,3,4,5,4,3,2 (skip last and first on reverse)
            if len(selected_frames) > 2:
                reverse_frames = selected_frames[-2:0:-1]  # Reverse, skip first and last
                selected_frames = selected_frames + reverse_frames
                print(f"  Applied palindrome: {len(selected_frames)} total frames")

        return selected_frames

    def save_frames(self, frames, output_dir):
        """
        Save individual frames as PNG files

        Args:
            frames (list): List of PIL.Image objects
            output_dir (str): Directory to save frames
        """
        os.makedirs(output_dir, exist_ok=True)

        for i, frame in enumerate(frames):
            frame.save(f"{output_dir}/frame_{i:02d}.png")

        print(f"  Saved {len(frames)} individual frames to {output_dir}/")

    def create_gif(self, frames, output_path):
        """
        Create animated GIF from frames

        Args:
            frames (list): List of PIL.Image objects
            output_path (str): Path for output GIF file
        """
        frames[0].save(
            output_path,
            save_all=True,
            append_images=frames[1:],
            duration=self.frame_duration,
            loop=0,  # Loop forever
            transparency=0,
            disposal=2,  # Clear frame before rendering next
            optimize=True
        )

        # Get file size
        size_bytes = os.path.getsize(output_path)
        size_kb = size_bytes / 1024

        print(f"\n✓ Created {output_path}")
        print(f"  Dimensions: {self.sprite_size}×{self.sprite_size}")
        print(f"  Frames: {len(frames)}")
        print(f"  FPS: {self.fps} ({self.frame_duration}ms per frame)")
        print(f"  File size: {size_bytes:,} bytes ({size_kb:.1f} KB)")
        print(f"  Background: {'Transparent' if self.bg_color is None else f'RGB{self.bg_color}'}")

    def process(self, input_path, output_path=None):
        """
        Process sprite sheet and create animated GIF

        Args:
            input_path (str): Path to input sprite sheet
            output_path (str): Path for output GIF (auto-generated if None)
        """
        # Generate output path if not provided
        if output_path is None:
            base_name = os.path.splitext(os.path.basename(input_path))[0]
            output_path = f"{base_name}_animated.gif"

        # Extract and process sprites
        frames = self.extract_sprites(input_path)

        # Save individual frames
        frames_dir = output_path.replace('.gif', '_frames')
        self.save_frames(frames, frames_dir)

        # Create animated GIF
        self.create_gif(frames, output_path)

        return output_path


def parse_excluded_frames(exclude_str):
    """Parse comma-separated list of frame numbers"""
    if not exclude_str:
        return [10, 11, 12]
    return [int(x.strip()) for x in exclude_str.split(',')]


def parse_hex_color(color_str):
    """Parse hex color string to RGB tuple"""
    if not color_str:
        return None

    # Handle 0x prefix
    if color_str.startswith('0x') or color_str.startswith('0X'):
        color_int = int(color_str, 16)
    else:
        color_int = int(color_str, 16)

    r = (color_int >> 16) & 0xFF
    g = (color_int >> 8) & 0xFF
    b = color_int & 0xFF
    return (r, g, b)


def main():
    parser = argparse.ArgumentParser(
        description='Convert 4x4 sprite sheets to animated GIFs',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s standing.png
  %(prog)s standing.png --size 512 --fps 10
  %(prog)s standing.png --bg-color 0xF5EBD9
  %(prog)s standing.png --size 128 --fps 8 --exclude 10,11,12
  %(prog)s standing.png --first-frame 1 --last-frame 8
  %(prog)s standing.png --first-frame 1 --last-frame 5 --palindrome
        """
    )

    parser.add_argument('input', help='Input sprite sheet file (4x4 grid)')
    parser.add_argument('--size', type=int, default=256,
                        help='Output sprite size in pixels (default: 256)')
    parser.add_argument('--fps', type=int, default=5,
                        help='Animation frames per second (default: 5)')
    parser.add_argument('--exclude', type=str, default='10,11,12',
                        help='Comma-separated frames to exclude (1-indexed, default: 10,11,12)')
    parser.add_argument('--first-frame', type=int, default=None,
                        help='First frame to include (1-indexed)')
    parser.add_argument('--last-frame', type=int, default=None,
                        help='Last frame to include (1-indexed)')
    parser.add_argument('--palindrome', action='store_true',
                        help='Create palindrome animation (forward then backward)')
    parser.add_argument('--bg-color', type=str, default=None,
                        help='Background color in 0xRRGGBB format (default: transparent)')
    parser.add_argument('--auto-background', action='store_true',
                        help='Auto-detect and keep background color from top-left corner')
    parser.add_argument('--tolerance', type=int, default=30,
                        help='Color matching tolerance for transparency (default: 30)')
    parser.add_argument('--remove-pad', type=int, default=0,
                        help='Remove N pixels from each boundary (crop padding, default: 0)')
    parser.add_argument('--output', type=str, default=None,
                        help='Output GIF filename (default: <input>_animated.gif)')

    args = parser.parse_args()

    # Validate input file
    if not os.path.exists(args.input):
        print(f"Error: Input file '{args.input}' not found")
        sys.exit(1)

    # Check for conflicting options
    if args.bg_color and args.auto_background:
        print("Error: Cannot use both --bg-color and --auto-background")
        sys.exit(1)

    if (args.first_frame or args.last_frame) and args.exclude != '10,11,12':
        print("Warning: Both --first-frame/--last-frame and --exclude specified.")
        print("         --first-frame/--last-frame will take precedence.")

    # Parse excluded frames (only used if frame range not specified)
    excluded_frames = parse_excluded_frames(args.exclude) if not (args.first_frame or args.last_frame) else []

    # Parse background color
    bg_color = parse_hex_color(args.bg_color) if args.bg_color else None

    # Detect background color from top-left if requested
    detected_bg = None
    if args.auto_background:
        try:
            test_img = Image.open(args.input)
            detected_bg = test_img.getpixel((0, 0))[:3]  # RGB only
            print(f"\n✓ Auto-detected background color: RGB{detected_bg} (0x{detected_bg[0]:02X}{detected_bg[1]:02X}{detected_bg[2]:02X})")
        except Exception as e:
            print(f"Error: Failed to detect background color: {e}")
            sys.exit(1)

    # Create animator
    print("="*60)
    print("SPRITE SHEET ANIMATOR")
    print("="*60)
    print(f"\nConfiguration:")
    print(f"  Output size: {args.size}×{args.size}")
    print(f"  FPS: {args.fps}")

    if args.first_frame or args.last_frame:
        print(f"  Frame range: {args.first_frame or 1} to {args.last_frame or 16} (1-indexed)")
    else:
        print(f"  Excluded frames: {sorted(excluded_frames)} (1-indexed)")

    if args.palindrome:
        print(f"  Palindrome: Yes (forward then backward)")

    if args.auto_background:
        print(f"  Background: Remove detected color RGB{detected_bg} (0x{detected_bg[0]:02X}{detected_bg[1]:02X}{detected_bg[2]:02X})")
    else:
        print(f"  Background: {'Transparent (corner detection)' if bg_color is None else f'Keep 0x{bg_color[0]:02X}{bg_color[1]:02X}{bg_color[2]:02X}'}")

    print(f"  Tolerance: {args.tolerance}")

    if args.remove_pad > 0:
        print(f"  Remove padding: {args.remove_pad}px from each boundary")

    print()

    animator = SpriteAnimator(
        sprite_size=args.size,
        fps=args.fps,
        excluded_frames=excluded_frames,
        bg_color=bg_color,
        bg_tolerance=args.tolerance,
        first_frame=args.first_frame,
        last_frame=args.last_frame,
        palindrome=args.palindrome,
        auto_background=args.auto_background,
        remove_pad=args.remove_pad
    )

    # Process sprite sheet
    output_path = animator.process(args.input, args.output)

    print("\n" + "="*60)
    print("✓ ANIMATION COMPLETE!")
    print("="*60)
    print(f"\nOutput files:")
    print(f"  • {output_path}")
    print(f"  • {output_path.replace('.gif', '_frames')}/")
    print()


if __name__ == '__main__':
    main()
