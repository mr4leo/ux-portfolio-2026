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
  // Sideways phones: text slides out left, top to bottom (gone by 0.10), then
  // the card glides to the horizontal center, crossing the text column only
  // after the text has left; the portrait fade (0.15) follows
  sidewaysText: [0, 0.04],
  sidewaysTextStagger: 0.01,
  sidewaysMove: [0.06, 0.09],
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

// ---- Phone hero ruler: size it and label it with the width it measures -----
// Upright phones: CSS sizes it to the headline's "end to end". Sideways
// phones: it sits above the profile card and measures the card.
const sidewaysPhone = window.matchMedia("(orientation: landscape) and (max-height: 500px)");

function updateRuler() {
  const ruler = document.querySelector(".hero__ruler");
  if (!ruler) return;
  ruler.style.width = "";
  if (!ruler.offsetParent) return; // hidden (desktop, short phones)
  if (sidewaysPhone.matches) {
    // Sits just above the card, as wide as it
    const card = document.querySelector(".hero-device").getBoundingClientRect();
    const box = ruler.offsetParent.getBoundingClientRect();
    ruler.style.width = `${card.width}px`;
    ruler.style.left = `${card.left - box.left}px`;
    ruler.style.top = `${card.top - box.top - ruler.offsetHeight - 10}px`;
  } else {
    ruler.style.left = "";
    ruler.style.top = "";
  }
  const line = ruler.querySelector(".hero__ruler-line");
  ruler.querySelector(".hero__ruler-value").textContent =
    `${Math.round(line.getBoundingClientRect().width)}px`;
}
updateRuler();
document.fonts.ready.then(updateRuler);
window.addEventListener("resize", updateRuler);
sidewaysPhone.addEventListener("change", updateRuler);

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
  const state = { g1: 0, g2: 0, g3: 0, shift: 0 };
  const cardLayers = [q("device-card"), q("device-footer")];
  const device = document.querySelector(".hero-device");
  const frames = all("card-frame");

  // Rounded-rect outline for a clip path (clockwise from the top-left corner)
  const roundRect = (x, y, w, h, r) =>
    `M${x + r},${y} H${x + w - r} A${r},${r} 0 0 1 ${x + w},${y + r} V${y + h - r} ` +
    `A${r},${r} 0 0 1 ${x + w - r},${y + h} H${x + r} A${r},${r} 0 0 1 ${x},${y + h - r} ` +
    `V${y + r} A${r},${r} 0 0 1 ${x + r},${y} Z`;

  // Phones: size the in-tablet card frame to the card and cut the screen out
  // of it, in the tablet's own (untransformed) coordinates
  function measureFrame(r, zoom) {
    const card = q("device-card");
    if (!device || !card || getComputedStyle(card).display === "none") {
      device?.classList.remove("is-framed");
      return;
    }
    const d = device.getBoundingClientRect();
    const cs = getComputedStyle(device);
    const inset = parseFloat(cs.paddingLeft) || 0;
    const outerR = parseFloat(cs.getPropertyValue("--card-radius")) || 28;
    const screenR = parseFloat(getComputedStyle(tablet).getPropertyValue("--screen-radius")) || 16;
    const w = r.width / zoom, h = r.height / zoom;
    const below = (d.bottom - r.bottom) / zoom; // screen bottom → card bottom
    const W = w + 2 * inset, H = h + inset + below;
    for (const el of frames) {
      Object.assign(el.style, { left: `${-inset}px`, top: `${-inset}px`, width: `${W}px`, height: `${H}px` });
    }
    const frame = tablet.querySelector(".tablet__frame");
    frame.style.clipPath =
      `path(evenodd, "${roundRect(0, 0, W, H, outerR)} ${roundRect(inset, inset, w, h, screenR)}")`;
    device.classList.add("is-framed");
  }

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

    measureFrame(r, zoom);

    // Sideways phones: the card first glides to the horizontal center
    const dx = sidewaysPhone.matches ? vw / 2 - (B.left + B.w / 2) : 0;

    geo = {
      vw, vh, B, zoom, baseRadius, border, dx,
      siteW: site.offsetWidth,
      siteH: site.offsetHeight,
      keys: [
        { s: 1, left: B.left, top: B.top },
        { s: s1, left: B.left + dx + B.w / 2 - (B.w * s1) / 2, top: B.top },
        { s: s2, left: (vw - B.w * s2) / 2, top: top2 },
        { s: s3, left: (vw - B.w * s3) / 2, top: (vh - B.h * s3) / 2 },
      ],
    };
  }

  // Tablet transform and site clip-path are both derived from this one rect,
  // so the window onto the site can never drift away from the screen.
  function render() {
    if (!geo || !tl) return;
    const { keys, B, zoom, baseRadius, border, siteW, siteH, dx } = geo;
    const { g1, g2, g3, shift } = state;
    // Start frame, moved along by the sideways glide (0 elsewhere)
    const k0 = { s: 1, left: B.left + dx * shift, top: B.top };
    let a = k0, b = keys[1], t = g1;
    if (g3 > 0) { a = keys[2]; b = keys[3]; t = g3; }
    else if (g2 > 0) { a = keys[1]; b = keys[2]; t = g2; }
    const s = lerp(a.s, b.s, t);
    const left = lerp(a.left, b.left, t);
    const top = lerp(a.top, b.top, t);

    const cssRadius = baseRadius * (1 - g3);
    tablet.style.transform =
      `translate(${(left - B.left) / zoom}px, ${(top - B.top) / zoom}px) scale(${s})`;
    tablet.style.setProperty("--screen-radius", `${cssRadius}px`);
    // The card's background and footer live outside .tablet; glide them too
    for (const el of cardLayers) if (el) el.style.transform = dx ? `translateX(${dx * shift}px)` : "";

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

  // The stroke color lives in CSS (--color-device-stroke); fade it to the same
  // color at 0 alpha so it doesn't darken on the way out.
  const transparentStroke = getComputedStyle(screen).borderTopColor
    .replace(/^rgba?\(([^,]+),\s*([^,]+),\s*([^,)]+).*$/, "rgba($1, $2, $3, 0)");

  const at = ([start]) => start;
  const dur = ([, d]) => d;

  // Built per layout: sideways phones get their own opening (see T); the
  // timeline is rebuilt if the phone rotates between layouts.
  function buildTimeline() {
    const sideways = sidewaysPhone.matches;
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

    if (sideways) {
      // The card's ruler fades first; the text slides out to the left, top to
      // bottom, before the card glides to center
      const textOut = [
        q("desk-ruler"),
        ...document.querySelectorAll(".hero__headline-below .line"),
        q("desk-bio"),
        q("desk-signature"),
      ];
      tl.to(textOut, {
        opacity: 0,
        x: -40,
        duration: dur(T.sidewaysText),
        stagger: T.sidewaysTextStagger,
        ease: "power1.in",
      }, at(T.sidewaysText))
        .to(state, { shift: 1, duration: dur(T.sidewaysMove), ease: "power2.inOut" }, at(T.sidewaysMove));
    } else {
      tl.to(lines, {
        opacity: 0,
        y: -16,
        duration: dur(T.headline),
        // Phones: the headline leaves as one block
        stagger: (i) => (isPhone() ? 0 : i * T.headlineStagger),
      }, at(T.headline))
        // Phones: the ruler leaves with the headline
        .to(all("desk-ruler"), { opacity: 0, duration: dur(T.headline) }, at(T.headline));
    }

    // autoAlpha also sets visibility: hidden at 0, so the faded CTA can't be clicked
    tl.to(all("hero-cta"), { autoAlpha: 0, y: 12, duration: dur(T.cta) }, at(T.cta))
      .to(portrait, { opacity: 0, scale: 0.96, y: 20, duration: dur(T.portrait) }, at(T.portrait))
      // Phones: the card's footer text leaves with the CTA; the card frame
      // itself stays and zooms with the screen
      .to(all("device-footer"), { autoAlpha: 0, duration: dur(T.cta) }, at(T.cta))
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
      .to([q("tablet-buttons"), q("tablet-shadow"), ...frames], { opacity: 0, duration: dur(T.frameOut) }, at(T.frameOut))
      .to(screen, { borderColor: transparentStroke, duration: dur(T.strokeOut) }, at(T.strokeOut))
      // Frame gone: stop it catching clicks or focus
      .set(tablet, { visibility: "hidden" }, 0.97)
      .to({}, { duration: 0.03 }, 0.97);
  }

  buildTimeline();

  sidewaysPhone.addEventListener("change", () => {
    // Back to the start values, then swap in the other layout's timeline
    tl.progress(0);
    tl.scrollTrigger.kill();
    tl.kill();
    Object.assign(state, { g1: 0, g2: 0, g3: 0, shift: 0 });
    buildTimeline();
    ScrollTrigger.refresh();
  });

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

  const st = () => tl.scrollTrigger;

  // ---- Navigation that respects the pin ----
  // A target inside the site sits at: end of pin + its offset within the stage.
  function offsetWithinStage(el) {
    let y = 0;
    for (let n = el; n && n !== stage; n = n.offsetParent) y += n.offsetTop;
    return y;
  }

  function scrollToTarget(target, instant) {
    let y;
    if (target === site) y = st().end;
    else if (site.contains(target)) y = st().end + offsetWithinStage(target);
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
