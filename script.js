/* ==========================================================================
   Hero "tablet screen → site" scroll reveal
   How it works and how to tune it: docs/hero-reveal.md
   ========================================================================== */

// ---- Tuning constants -----------------------------------------------------
const PIN_LENGTH = { desktop: 4, phone: 3 }; // in viewport heights
const PHONE_MAX = 767; // px; phone < 768, tablet 768–1023, desktop ≥ 1024
const SCRUB = 0.6; // seconds of scrub smoothing
const SITE_DRIFT = 40; // px the site drifts up while revealing
const EDGE_GAP = 0.03; // Frame 4: desk visible around the tablet, as a share of viewport width
const OVERSHOOT = 0.12; // Frame 5: how far past the viewport edges the frame ends
const INTERACTIVE_AT = 0.95; // progress at which the site counts as "entered"

// Timeline positions (0–1 of the pin). Each entry: [start, duration].
const T = {
  cta: [0.05, 0.1],
  headline: [0.1, 0.09], // per line; lines start 0.03 apart (desktop/tablet)
  headlineStagger: 0.03,
  portrait: [0.15, 0.15],
  blankIn: [0.3, 0.15], // screen texture → solid site color
  grow1: [0.3, 0.2], // Frame 2→3: grow from top-center over the bio
  cardOut: [0.28, 0.12], // phones: white card + footer fade as the screen grows
  grow2: [0.5, 0.25], // Frame 3→4: nearly full width, covers label + stylus
  blankOut: [0.52, 0.2], // site shows through the screen
  drift: [0.52, 0.43],
  grow3: [0.75, 0.2], // Frame 4→5: frame passes the viewport edges
  frameOut: [0.75, 0.12], // buttons + shadow fade
  strokeOut: [0.78, 0.15],
};

// ---- Plain anchor scrolling (fallback when the reveal isn't running) -------
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function smoothScrollTo(target) {
  target.scrollIntoView({
    behavior: reduceMotion.matches ? "auto" : "smooth",
    block: "start",
  });
}

function bindPlainAnchors() {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const id = link.getAttribute("href");
      if (!id || id === "#") return;
      const target = document.querySelector(id);
      if (!target) return;
      event.preventDefault();
      smoothScrollTo(target);
    });
  });
}

// ---- Phone hero ruler: label it with the width it actually measures --------
function updateRulerLabel() {
  const ruler = document.querySelector(".hero__ruler");
  if (!ruler || !ruler.offsetParent) return; // hidden (desktop, short phones)
  const value = ruler.querySelector(".hero__ruler-value");
  value.textContent = `${Math.round(ruler.querySelector(".hero__ruler-line").getBoundingClientRect().width)}px`;
}
updateRulerLabel();
window.addEventListener("resize", updateRulerLabel);

const root = document.documentElement;
const canReveal =
  root.classList.contains("has-reveal") && window.gsap && window.ScrollTrigger;

if (!canReveal) {
  // GSAP missing (offline/blocked) or reduced motion: normal document flow.
  root.classList.remove("has-reveal");
  bindPlainAnchors();
} else {
  document.fonts.ready.then(initReveal);
}

// ---- The reveal -------------------------------------------------------------
function initReveal() {
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  const q = (name) => document.querySelector(`[data-anim="${name}"]`);
  const track = q("track");
  const stage = q("stage");
  const spacer = q("spacer");
  const pinLength = () =>
    window.innerHeight * (isPhone() ? PIN_LENGTH.phone : PIN_LENGTH.desktop);
  const tablet = q("tablet");
  const screen = q("screen");
  const site = q("site");
  const siteInner = site.querySelector(".work__inner");
  // Desktop and phone each have their own headline, portrait and CTA (only
  // one set is displayed), so these select both.
  const all = (name) => document.querySelectorAll(`[data-anim="${name}"]`);
  const lines = document.querySelectorAll('[data-anim="hero-headline"] .line');
  const portrait = all("hero-portrait");

  const lerp = (a, b, t) => a + (b - a) * t;
  const isPhone = () => window.innerWidth <= PHONE_MAX;

  // Geometry, re-measured on every ScrollTrigger refresh (resize/rotate).
  let geo = null;
  let tl = null;
  const state = { g1: 0, g2: 0, g3: 0 };

  function measure() {
    tablet.style.transform = "none";
    tablet.style.setProperty("--screen-radius", "");
    const stageRect = stage.getBoundingClientRect();
    const r = screen.getBoundingClientRect();
    const cs = getComputedStyle(screen);
    const vw = document.documentElement.clientWidth;
    // The hero is 100svh, so this stays put when a phone's address bar hides
    // or shows (window.innerHeight would jump by the toolbar's height).
    const vh = q("desk-bg").offsetHeight || window.innerHeight;
    const B = {
      left: r.left - stageRect.left,
      top: r.top - stageRect.top,
      w: r.width,
      h: r.height,
    };
    // Visual px per CSS px inside the hero (≠ 1 when .hero__inner is zoomed)
    const zoom = r.width / screen.offsetWidth;
    const baseRadius = parseFloat(getComputedStyle(tablet).getPropertyValue("--screen-radius")) || 0;
    const border = parseFloat(cs.borderTopWidth) || 0;

    // Frame 3: grow from top-center until only the bio's last line shows.
    const bio = q("desk-bio").getBoundingClientRect();
    const bioLine = parseFloat(getComputedStyle(q("desk-bio")).lineHeight) || 28;
    const coverTo = bio.bottom - stageRect.top - bioLine;
    // Landscape: stop before the sides. Portrait (phones): the screen is narrow,
    // so let it spill past the sides and grow by height instead.
    const portraitView = vw < vh;
    let s1 = (coverTo - B.top) / B.h;
    s1 = Math.min(Math.max(s1, 1.08), portraitView ? 1.6 : (vw * 0.94) / B.w);

    // Frame 4: nearly full width; desk shows only around the edges.
    const edge = Math.max(16, vw * EDGE_GAP);
    const s2 = Math.max(s1, (vw - 2 * edge) / B.w, portraitView ? (vh * 0.85) / B.h : 0);
    const h2 = B.h * s2;
    // Rise above the label/stylus row so the desk only shows around the edges
    const meta = q("desk-label").getBoundingClientRect();
    const coverTop = Math.max(0, Math.min(edge, meta.top - stageRect.top - 12));
    const top2 = !portraitView && h2 < vh - 2 * edge ? (vh - h2) / 2 : coverTop;

    // Frame 5: past every viewport edge.
    const over = Math.max(vw, vh) * OVERSHOOT;
    const s3 = Math.max((vw + 2 * over) / B.w, (vh + 2 * over) / B.h);

    geo = {
      vw, vh, B, zoom, baseRadius, border,
      siteW: site.offsetWidth,
      siteH: site.offsetHeight,
      keys: [
        { s: 1, left: B.left, top: B.top },
        { s: s1, left: B.left + B.w / 2 - (B.w * s1) / 2, top: B.top },
        { s: s2, left: (vw - B.w * s2) / 2, top: top2 },
        { s: s3, left: (vw - B.w * s3) / 2, top: (vh - B.h * s3) / 2 },
      ],
    };
  }

  // Tablet transform and site clip-path are both derived from this one rect,
  // so the window onto the site can never drift away from the screen.
  function render() {
    if (!geo || !tl) return;
    const { keys, B, zoom, baseRadius, border, siteW, siteH } = geo;
    const { g1, g2, g3 } = state;
    let a = keys[0], b = keys[1], t = g1;
    if (g3 > 0) { a = keys[2]; b = keys[3]; t = g3; }
    else if (g2 > 0) { a = keys[1]; b = keys[2]; t = g2; }
    const s = lerp(a.s, b.s, t);
    const left = lerp(a.left, b.left, t);
    const top = lerp(a.top, b.top, t);

    const cssRadius = baseRadius * (1 - g3);
    tablet.style.transform =
      `translate(${(left - B.left) / zoom}px, ${(top - B.top) / zoom}px) scale(${s})`;
    tablet.style.setProperty("--screen-radius", `${cssRadius}px`);

    const p = tl.progress();
    if (p >= 1) {
      site.style.clipPath = "none";
      return;
    }
    // Keep the site fully hidden until the screen starts to show it, so no
    // sub-pixel sliver can peek past the tablet's border before then.
    if (p < T.blankOut[0]) {
      site.style.clipPath = "inset(0 0 100% 0)";
      return;
    }

    // Inner (padding-box) edge of the screen, in the site's coordinates
    // (the site starts at the stage's top-left while pinned), pulled in 1px
    // more so antialiased edges never overlap the border.
    const inset = (border * zoom + 1) * s;
    const x1 = left + inset;
    const y1 = top + inset;
    const x2 = left + B.w * s - inset;
    const y2 = top + B.h * s - inset;
    const r = Math.max(0, (cssRadius - border) * zoom * s);

    // Edges past the viewport clamp to the site's own edges, so nothing gets
    // cut off when the pin releases. A corner keeps its rounding only while
    // both of its edges are on screen.
    // Live height here: with the toolbar hidden the screen is taller, and the
    // bottom edge only counts as off-screen once it really is.
    const cT = y1 <= 0, cL = x1 <= 0, cR = x2 >= siteW, cB = y2 >= window.innerHeight;
    const iT = cT ? 0 : y1;
    const iL = cL ? 0 : x1;
    const iR = cR ? 0 : siteW - x2;
    const iB = cB ? 0 : siteH - y2;
    const rad = (c1, c2) => (c1 || c2 ? 0 : r);
    site.style.clipPath =
      `inset(${iT}px ${iR}px ${iB}px ${iL}px round ` +
      `${rad(cT, cL)}px ${rad(cT, cR)}px ${rad(cB, cR)}px ${rad(cB, cL)}px)`;
  }

  // ---- Timeline ----
  gsap.set(portrait, { x: 0, xPercent: -50 });
  gsap.set(screen, { "--fx": 1 });

  tl = gsap.timeline({
    defaults: { ease: "none" },
    onUpdate: render,
    scrollTrigger: {
      // The stage is pinned with CSS sticky; this only maps scroll → progress.
      trigger: track,
      start: "top top",
      end: () => "+=" + spacer.offsetHeight,
      scrub: SCRUB,
      invalidateOnRefresh: true,
      onToggle: (self) => tablet.classList.toggle("is-animating", self.isActive),
    },
  });

  // The stroke color lives in CSS (--color-device-stroke); fade it to the same
  // color at 0 alpha so it doesn't darken on the way out.
  const transparentStroke = getComputedStyle(screen).borderTopColor
    .replace(/^rgba?\(([^,]+),\s*([^,]+),\s*([^,)]+).*$/, "rgba($1, $2, $3, 0)");

  const at = ([start]) => start;
  const dur = ([, d]) => d;

  // autoAlpha also sets visibility: hidden at 0, so the faded CTA can't be clicked
  tl.to(all("hero-cta"), { autoAlpha: 0, y: 12, duration: dur(T.cta) }, at(T.cta))
    .to(lines, {
      opacity: 0,
      y: -16,
      duration: dur(T.headline),
      // Phones: the headline leaves as one block
      stagger: (i) => (isPhone() ? 0 : i * T.headlineStagger),
    }, at(T.headline))
    .to(portrait, { opacity: 0, scale: 0.96, y: 20, duration: dur(T.portrait) }, at(T.portrait))
    // Phones: the ruler leaves with the headline; the white card and its footer
    // fade as the screen starts to grow out of them
    .to(all("desk-ruler"), { opacity: 0, duration: dur(T.headline) }, at(T.headline))
    .to([...all("device-card"), ...all("device-footer")], { autoAlpha: 0, duration: dur(T.cardOut) }, at(T.cardOut))
    .to(q("screen-blank"), { opacity: 1, duration: dur(T.blankIn) }, at(T.blankIn))
    .to(screen, { "--fx": 0, duration: dur(T.blankIn) }, at(T.blankIn))
    // Hidden under the blank layer, so these can switch off instantly
    .set(q("screen-bg"), { opacity: 0 }, at(T.blankIn) + dur(T.blankIn) + 0.01)
    .set(screen, { backgroundImage: "none" }, at(T.blankIn) + dur(T.blankIn) + 0.01)
    .to(state, { g1: 1, duration: dur(T.grow1), ease: "power1.inOut" }, at(T.grow1))
    .to(state, { g2: 1, duration: dur(T.grow2), ease: "power1.inOut" }, at(T.grow2))
    .to(q("screen-blank"), { opacity: 0, duration: dur(T.blankOut) }, at(T.blankOut))
    .fromTo(siteInner, { y: SITE_DRIFT }, { y: 0, duration: dur(T.drift), ease: "power1.out" }, at(T.drift))
    .to(state, { g3: 1, duration: dur(T.grow3), ease: "power2.in" }, at(T.grow3))
    .to([q("tablet-buttons"), q("tablet-shadow")], { opacity: 0, duration: dur(T.frameOut) }, at(T.frameOut))
    .to(screen, { borderColor: transparentStroke, duration: dur(T.strokeOut) }, at(T.strokeOut))
    // Frame gone: stop it catching clicks or focus
    .set(tablet, { visibility: "hidden" }, 0.97)
    .to({}, { duration: 0.03 }, 0.97);

  ScrollTrigger.addEventListener("refreshInit", () => {
    site.style.clipPath = "";
    spacer.style.height = pinLength() + "px";
  });
  // ignoreMobileResize skips a full refresh when only the height changes (a
  // phone's toolbar collapsing). Re-measure anyway so the frame and the site's
  // clip keep using the same rect; on phones the svh-based geometry doesn't
  // change, so nothing jumps.
  let resizeFrame = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      measure();
      render();
    });
  });

  ScrollTrigger.addEventListener("refresh", () => {
    measure();
    render();
  });

  const st = tl.scrollTrigger;

  // ---- Navigation that respects the pin ----
  // A target inside the site sits at: end of pin + its offset within the stage.
  function offsetWithinStage(el) {
    let y = 0;
    for (let n = el; n && n !== stage; n = n.offsetParent) y += n.offsetTop;
    return y;
  }

  function scrollToTarget(target, instant) {
    let y;
    if (target === site) y = st.end;
    else if (site.contains(target)) y = st.end + offsetWithinStage(target);
    else y = target.getBoundingClientRect().top + window.scrollY;
    // Respect scroll-margin-top (e.g. room for the sticky case-study nav)
    if (target !== site) y -= parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
    window.scrollTo({ top: y, behavior: instant || reduceMotion.matches ? "auto" : "smooth" });
  }

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const id = link.getAttribute("href");
      if (!id || id === "#") return;
      const target = document.querySelector(id);
      if (!target) return;
      event.preventDefault();
      scrollToTarget(target);
      history.pushState(null, "", id);
    });
  });

  // Keyboard users tabbing into the site before it's revealed: jump to it.
  site.addEventListener("focusin", () => {
    if (tl.progress() < INTERACTIVE_AT) scrollToTarget(site, true);
  });

  // Deep links (#work, #thrive …) on load and on back/forward.
  function handleHash(instant) {
    const target = location.hash && document.querySelector(location.hash);
    if (target) scrollToTarget(target, instant);
  }
  window.addEventListener("popstate", () => handleHash(true));

  ScrollTrigger.refresh();
  if (location.hash) requestAnimationFrame(() => handleHash(true));
}
