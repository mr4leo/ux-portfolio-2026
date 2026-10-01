# Brief: "Tablet Screen → Site" Scroll Reveal (Hero)

## Goal
The landing page opens on a tablet device sitting on a light "desk". As the user scrolls:
1. The hero content inside the tablet fades away.
2. The screen settles to the site's dark background.
3. The tablet grows toward the viewer and covers the desk.
4. The real site shows through the tablet screen at full size.
5. The tablet frame passes beyond the viewport edges and the user is inside the site.

This has to feel **beautifully smooth and premium on desktop, tablet and phone**. Smoothness and responsiveness are acceptance criteria, not polish.

Stack: [Framer / React + GSAP ScrollTrigger / Next.js / Webflow — fill in]
Hero component/file: [path]
Site section revealed (nav + case studies): [path]

## Elements (each one a separate, targetable element with `data-anim="..."`)
**The desk (outside the tablet):**
- `desk-bg`: light background (#F2F2F2-ish) with a faint dotted grid
- `desk-label`: "Product Designer / Enterprise UX", top left
- `desk-stylus`: stylus image with a "23 mm" dimension callout, top right
- `desk-bio`: 4-line bio paragraph below the tablet
- `desk-signature`: script signature ("— [Name]")

**The tablet:**
- `tablet`: wrapper with a dark bezel, rounded corners (~28px), soft shadow
- `tablet-buttons`: two top buttons and one left-side button (they stay attached to the frame as it grows)
- `screen`: the screen area, which acts as a clipping mask

**Inside the screen (the hero, which is many components, not one image):**
1. `screen-bg`: dark teal topographic/wavy texture
2. `hero-portrait`: cut-out portrait, bottom-center
3. `hero-headline`: "Digital products designed from end to end", with "Digital" in blue and design-tool selection handles around "designed"
4. `hero-cta`: "↓ Scroll Down" pill, bottom-right

**The revealed site:**
- `site`: the real nav pill (Thrive / Learn.VML / Open Everydai thumbnails) and case-study cards on #2A2A2A. It is rendered once, at full size.

## Storyboard → scroll timeline
Pin the stage inside a tall scroll container (`--pin-length`, default 400vh desktop / 300vh mobile). Progress runs 0→1 across the pin. Every value is scrubbed by scroll and fully reversible.

**Frame 1 → 2: the hero clears (0.00–0.30)**
- 0.00–0.05: rest.
- 0.05–0.15: `hero-cta` fades out (opacity →0, y →12px).
- 0.10–0.25: `hero-headline` leaves line by line (opacity →0, y →-16px). The selection handles leave with "designed".
- 0.15–0.30: `hero-portrait` fades out (opacity →0, scale →0.96, y →20px).
- Result: only the wavy texture is left on screen.

**Frame 2 → 3: the screen goes blank and the tablet starts growing (0.30–0.50)**
- `screen-bg` texture crossfades to solid **#2A2A2A** (the site background, so the hand-off is seamless).
- The `tablet` scales up from its **top-center**: it grows wider on both sides and extends downward. The top edge barely moves.
- The tablet sits **above** the desk (z-index). It slides over `desk-bio`, which is **covered, not faded**. In Frame 3 only the last bio line and the signature are still showing below it.
- The bezel stays visible and the buttons stay attached.

**Frame 3 → 4: the site shows through (0.50–0.75)**
- The tablet keeps growing and now also extends upward, until it is nearly full-width and covers `desk-label`, `desk-stylus`, `desk-bio` and `desk-signature`. Only the dotted desk stays visible around the edges.
- `site` fades in **inside the screen at its true full-viewport size**, cropped by the screen. It's a window onto the real site, **not a miniature copy**.
- The site content has a slight upward drift (about 40px) for depth.

**Frame 4 → 5: into the site (0.75–1.00)**
- The tablet frame expands past every viewport edge. Corner radius goes to 0, the bezel and buttons fade, and the shadow goes away.
- `desk-bg` is no longer visible, so the page is the site's #2A2A2A.
- 0.95–1.00: unpin. The nav and links become interactive and normal scroll continues into the case studies and footer.

## Reveal technique (required)
- Render `site` once, full-viewport, behind the stage.
- The screen is a **mask**: `clip-path: inset(t r b l round R)`, with values computed every frame from the tablet screen's current on-screen rect, so the site lines up with the screen at every point of the growth.
- The tablet's growth is a `transform: scale()/translate()` on the frame. Never animate width, height, top or left. The clip-path inset is derived from the same values so the two never drift apart.
- Measure the base rects with `getBoundingClientRect()` at init. Re-measure on resize/orientation change (debounced about 150ms) and refresh the scroll calculations.

## Responsive behavior (desktop, tablet, phone)
Breakpoints: desktop ≥ 1024px, tablet 768–1023px, phone < 768px. Test landscape and portrait on tablet and phone.

- **Desktop:** layout as in the storyboard. The tablet is landscape, about 70% of viewport width (max 1100px).
- **Tablet:** the tablet device is about 88% of viewport width. Keep the stylus, or hide it if it crowds the label. Same timeline.
- **Phone:**
  - The device switches to **portrait orientation**, about 92vw wide with an aspect ratio of about 3:4, so the hero isn't a tiny letterbox.
  - The hero re-composes: the headline goes on top, the portrait sits bottom-center, and the CTA goes bottom-center.
  - The stylus is hidden. The label and bio stack above and below the device.
  - The headline fades as one block, not line by line.
  - The pin length is shorter (about 300vh).
  - Don't animate blur or heavy shadows on phones; use opacity and transform only.
- **Sizing:** use fluid `clamp()` for type and spacing. All growth targets are calculated from the measured viewport, never hard-coded pixels, so every screen size ends with the frame fully past the edges.
- **Mobile viewport:** use `svh`/`dvh`/`lvh` instead of `100vh`, so iOS and Android address-bar show/hide doesn't cause jumps. Ignore resize events that come only from the address bar (for GSAP: `ScrollTrigger.config({ ignoreMobileResize: true })`).
- **Touch:** native momentum scrolling has to feel natural. No scroll-jacking and no blocked flicks. A fast flick may skip through the timeline but must land in a correct, consistent state.

## Smoothness requirements
- Animate only `transform`, `opacity` and `clip-path`. Add `will-change` while the pin is active and remove it after.
- Scrub smoothing is light: GSAP `scrub: 0.6` or a soft spring. Optional smooth scrolling on desktop (Lenis) if it doesn't fight trackpad inertia. **Off** on touch devices.
- Hold 60fps on a mid-range laptop and a 3-year-old iPhone/Android; 120fps where the display supports it. No long tasks over 50ms during scroll. No layout shift (CLS ≈ 0).
- **Assets:**
  - Serve the portrait and texture as AVIF/WebP with `srcset`/`sizes`.
  - Preload the hero portrait. Lazy-load case-study images, but decode them before the reveal (by progress ~0.45) so nothing pops in.
  - Export the texture at about 2x screen size max.
- Fonts must be loaded before the stage is measured (`document.fonts.ready`), so the rects don't shift.

## Accessibility and robustness
- The hero text stays as real DOM text.
- `site` is `inert` / `aria-hidden` until progress ≥ 0.95, so nothing hidden can be focused or clicked.
- **`prefers-reduced-motion: reduce`:** no pin and no scrub. Show the hero normally; the site follows below with a simple crossfade.
- If JS fails, the page shows the hero, then the site, in normal document flow.
- Deep links (#works) and the browser back button land on the site in its correct state. Refreshing mid-scroll restores the correct frame.

## Acceptance criteria
1. Frame 1 matches the current design at 1440, 1024, 768 and 390px widths.
2. Scrolling slowly shows: CTA → headline → portrait → texture-to-#2A2A2A, then tablet growth over the bio, then the site shown through the screen, then full site. This is the storyboard order.
3. The site is never shown scaled down. It is always full-size and cropped by the screen.
4. The final frame shows no bezel, desk or dotted-grid remnants on any screen size or orientation.
5. Scrolling back up restores Frame 1 exactly.
6. 60fps with no jank on desktop Chrome/Safari/Firefox, iPad Safari, iOS Safari and Android Chrome (verified with the Performance panel and real devices).
7. Rotating a phone or tablet mid-animation re-measures and stays aligned.
8. Reduced-motion and no-JS fallbacks work.

## Deliverables
- The stage/hero component, the revealed-site wrapper, and the scroll-animation hook/timeline, with all timings, colors (`--screen-blank: #2A2A2A`, `--site-bg`), pin lengths and breakpoints as constants at the top
- A short README covering: how to tune timings, how to add or reorder hero layers, and how the clip-path is synced to the tablet transform
- A note of which devices and browsers were tested