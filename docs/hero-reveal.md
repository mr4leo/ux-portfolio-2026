# Hero scroll reveal: "tablet screen → site"

As you scroll, the hero inside the tablet clears away, the tablet grows toward you, and the real case-studies section shows through the screen until you're inside the site.

- **Code:** [`script.js`](../script.js) (timeline and geometry), plus the `.has-reveal` block near the end of [`styles.css`](../styles.css).
- **Library:** GSAP 3.12.5 + ScrollTrigger, loaded from cdnjs. There is no build step.

## How it's built

Layers inside `.reveal` (`data-anim="stage"`), from back to front:

1. **Desk:** `.hero`, absolutely positioned, one viewport tall. It holds the label, stylus, bio and signature.
2. **Site:** `.work`, the real section in normal flow at the top of the stage, clipped to the tablet screen with `clip-path`.
3. **Tablet:** `.tablet`, with `z-index: 2`. It holds the frame, the buttons, and the hero layers inside the screen.

The pin is native CSS: `.reveal` is `position: sticky; top: 0` inside `.reveal-track`, and `.reveal-spacer` sets the scroll distance (`PIN_LENGTH` × viewport height, set on each refresh). ScrollTrigger only maps that scroll distance to timeline progress; it doesn't pin anything itself. When the stick releases, the clip is removed and the same `.work` section keeps scrolling into the case studies and footer. Nothing is duplicated.

> Why not `pin: true`? After a GSAP pin releases, it leaves the stage offset with a `transform`. Sticky elements inside the stage (the case-study nav) work out their position from the layout and ignore that transform, so they would stick in the wrong place. CSS sticky leaves no transform behind.

### How the clip stays in sync with the tablet

`measure()` runs on every ScrollTrigger refresh: on load, on resize and on rotation (ScrollTrigger debounces these). It records:

- the screen's untransformed rectangle `B`
- the zoom factor (on short desktop windows `.hero__inner` uses `zoom: 0.87`)
- four keyframe rectangles (Frames 2, 3, 4 and 5)

`render()` runs on every timeline update. It turns the current progress (`state.g1`, `g2`, `g3`) into one on-screen rectangle, then derives two things from that same rectangle:

- the tablet's `transform: translate() scale()`
- the site's `clip-path: inset(... round ...)`

Because both come from one set of numbers, they can't drift apart. Only `transform`, `opacity` and `clip-path` are animated. The one exception is the screen's corner radius at the very end.

Two details in `render()`:

- **Before the reveal:** until progress reaches `T.blankOut[0]`, the site is fully clipped away. This stops sub-pixel slivers from showing at the tablet's border.
- **Edges past the viewport:** an edge of the window that goes past the viewport snaps to the site's own edge, and corners on that side lose their rounding. That way nothing gets cut off when the pin releases.

## Tuning

Everything is in the constants at the top of `script.js`.

| Constant | What it controls |
|---|---|
| `PIN_LENGTH` | Scroll distance in viewport heights (desktop and tablet: 4, phone: 3). Bigger means slower. |
| `T.*` | Each step's `[start, duration]` as a share of the pin (0–1). They match the storyboard in the brief. |
| `SCRUB` | Smoothing, in seconds. 0 means locked to the scrollbar. |
| `SITE_DRIFT` | How far the site drifts up while it's revealed. |
| `EDGE_GAP` | How much desk shows around the tablet in Frame 4. |
| `OVERSHOOT` | How far past the viewport edges the frame ends. |
| `PHONE_MAX` | Below this width, the headline leaves as one block and the pin is shorter. |

The growth targets are calculated from the measured viewport, never hard-coded. On portrait screens (phones), the tablet is allowed to spill past the sides so it can grow by height.

## Adding or reordering hero layers

1. Put the element inside `.tablet__screen` with a `data-anim="..."` name.
2. Look it up with `q("name")` and add a tween to the timeline in `initReveal()`, for example:

   ```js
   .to(q("name"), { opacity: 0, y: 10, duration: 0.1 }, 0.12)
   ```

3. Keep hero layers finished before `T.blankIn` ends (0.45). After that, the screen is meant to be blank.

## Fallbacks and accessibility

- **No JS, GSAP blocked, or `prefers-reduced-motion: reduce`:** `.has-reveal` is never applied or gets removed. The page is the normal hero followed by the case studies, in plain document flow.
- **Hero text:** the hero stays real DOM text.
- **Keyboard and links:**
  - Tabbing into the site before it's revealed jumps the scroll to the revealed state.
  - In-page links (`#work`, `#thrive` …), deep links on load, and back/forward land on the correct position after the pin.
- **Clicks:** at 0.97 the tablet frame becomes `visibility: hidden`, so it can't catch clicks or focus.

## Deviations from the brief

- **Background colours:** the screen fades to the site's `--surface-dark` (`#1d1f20`), not `#2A2A2A`.
- **Phone layout:** the current phone layout and frame style are kept. The brief's 3:4 portrait device and dark bezel weren't used.
- **Site interactivity before the reveal:** the brief asks for the site to be `inert` until 0.95. It isn't, because that would make the case studies unreachable by keyboard. Focus instead triggers a jump to the revealed state.
- **Image formats:** images are still PNG. Converting the portrait and texture to AVIF/WebP with `srcset` is still to do. The texture (`Abstract Abyss.png`) is 2.4 MB, so it's the first candidate.
- **Smooth-scroll library:** Lenis isn't used. Native scrolling keeps trackpad and touch inertia natural.

## Tested

Tested in headless Chrome by scrubbing to fixed progress points:

| Viewport | Checked |
|---|---|
| 1440×800 desktop (with zoom) and 1440×1000 desktop | Full sequence |
| 390×844 phone | Full sequence |
| Any | GSAP blocked, and reduced motion |
| Any | Scrolling past the pin |

Still to check on real devices: frame rate (Performance panel), iPad and iOS Safari, Android Chrome, Firefox, rotating mid-animation, and refreshing mid-scroll.
