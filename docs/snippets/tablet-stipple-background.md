# Tablet stipple background (CSS-only)

An image-free stand-in for the halftone "Abstract Abyss" texture on the hero tablet screen. It uses a fine dot grid on a dark slate gradient, with a few soft light bands that hint at waves.

It was retired in favour of `images/Abstract Abyss.png` (multiply, 50%). Keep it for when you want the look without loading a 2.4 MB image, or as a fallback while the image loads.

## Usage

Apply to any dark panel. The dot colour uses the `--dot-on-dark` variable from `styles.css`. Swap in the literal value if you use it elsewhere.

```css
.stipple-panel {
  background-color: #1f2a31;
  background-image:
    /* 6px dot grid */
    radial-gradient(circle, var(--dot-on-dark, rgba(255, 255, 255, 0.09)) 0.9px, transparent 1.4px),
    /* soft light bands suggesting waves */
    radial-gradient(ellipse 55% 22% at 30% 92%, rgba(255, 255, 255, 0.07), transparent 70%),
    radial-gradient(ellipse 45% 26% at 82% 62%, rgba(255, 255, 255, 0.06), transparent 70%),
    radial-gradient(ellipse 60% 20% at 55% 12%, rgba(255, 255, 255, 0.05), transparent 70%),
    /* dark slate base, lighter toward the right */
    linear-gradient(100deg, #17232b 0%, #242e35 50%, #393e42 100%);
  background-size: 6px 6px, 100% 100%, 100% 100%, 100% 100%, 100% 100%;
}
```

## Tweaks

- **Denser or looser dots:** change the first `background-size` value (`6px 6px`). Keep the dot radius (`0.9px` / `1.4px`) at roughly a quarter of the spacing.
- **Stronger waves:** raise the alpha on the three ellipse gradients (0.05–0.07). Move them by changing the `at X% Y%` positions.
- **Pairs well with** the blue glow and glare pseudo-elements on `.tablet__screen::before` / `::after` in `styles.css`.
