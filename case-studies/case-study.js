// Case study videos: play silently on loop once on screen. The first tap
// turns the sound on, then each tap pauses / plays. With reduced motion they
// wait paused until tapped.
const ICONS = {
  sound: '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/>',
  pause: '<path d="M6 5h4v14H6zm8 0h4v14h-4z"/>',
  play: '<path d="M7 4v16l13-8z"/>',
};
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Sections slide up and fade in: the ones on screen at load in sequence,
// the rest as they scroll into view. A section that is already well up the
// screen when it's reached, or reached while scrolling fast, appears at
// once instead of fading in under the cursor. The <head> snippet adds .cs-js before paint.
const sections = [...document.querySelectorAll("main.cs > *")];
const show = (el, instant) => {
  if (instant) el.classList.add("is-instant");
  el.classList.add("is-visible");
};
if (reduceMotion || !("IntersectionObserver" in window)) {
  sections.forEach((el) => show(el, true));
} else {
  // On screen at load: reveal in sequence. Measured now rather than in the
  // observer, whose first report can arrive a few frames late.
  // Arriving through the page transition, which animates them itself: show at once.
  const onScreen = sections.filter((el) => el.getBoundingClientRect().top < innerHeight);
  const transition = document.documentElement.classList.contains("pt-cover");
  onScreen.forEach((el, i) => (transition ? show(el, true) : setTimeout(() => show(el), 120 * i)));
  // Scroll speed in px/ms, smoothed over recent frames
  let speed = 0, lastY = scrollY, lastT = performance.now();
  addEventListener("scroll", () => {
    const now = performance.now();
    const v = Math.abs(scrollY - lastY) / Math.max(now - lastT, 1);
    speed = speed * 0.6 + v * 0.4;
    lastY = scrollY;
    lastT = now;
  }, { passive: true });
  const reveal = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      reveal.unobserve(entry.target);
      const fast = speed > 1.5 && performance.now() - lastT < 150;
      show(entry.target, fast || entry.boundingClientRect.top < innerHeight * 0.5);
    });
  }, { rootMargin: "0px 0px -8% 0px" });
  sections.filter((el) => !onScreen.includes(el)).forEach((el) => reveal.observe(el));
}
window.csReady = true;

// Silent intro animations: play once on arrival (after the page transition
// has cleared; never with reduced motion), then each click plays it once more.
document.querySelectorAll(".cs-video__replay").forEach((button) => {
  const video = button.querySelector("video");
  const playOnce = () => {
    video.currentTime = 0;
    video.play().catch(() => {});
  };
  button.addEventListener("click", playOnce);
  if (reduceMotion) return;
  const entering = document.documentElement.classList.contains("pt-cover");
  setTimeout(playOnce, entering ? 600 : 0);
});

// Dividers meet tabs: when a centred tab hangs below a row on the shared
// split (gutter + 400px left column; even splits are left alone), the divider
// moves onto the tab's left edge, and so do the rows stacked above it on the
// same split, so the line runs straight down to the tab. The tab stays put.
document.querySelectorAll(".cs-tabbar").forEach((bar) => {
  const tab = bar.querySelector(".cs-tab");
  const twoCol = (el) => el && getComputedStyle(el).gridTemplateColumns.split(" ").length === 2;
  const rows = [];
  for (let el = bar.previousElementSibling ?? bar.parentElement.previousElementSibling; twoCol(el); el = el.previousElementSibling) rows.push(el);
  if (!tab || !rows.length) return;
  const wide = matchMedia("(min-width: 901px)");
  const align = () => {
    rows.forEach((row) => row.classList.remove("cs-split"));
    // The header's side padding is the page gutter
    const gutter = parseFloat(getComputedStyle(document.querySelector(".cs-header")).paddingLeft);
    const tabLeft = tab.getBoundingClientRect().left;
    for (const row of rows) {
      const first = row.firstElementChild;
      if (!wide.matches || Math.abs(first.getBoundingClientRect().width - (gutter + 400)) >= 1) break;
      // A border on the left column's right side sits inside it: one more px
      const border = parseFloat(getComputedStyle(first).borderRightWidth) || 0;
      row.style.setProperty("--cs-split", `${tabLeft - row.getBoundingClientRect().left + border}px`);
      row.classList.add("cs-split");
    }
  };
  align();
  new ResizeObserver(align).observe(tab);
  addEventListener("resize", align);
});

// Hold to magnify: pressing and holding on a .cs-magnify group shows a round
// lens with a 2.5x copy of it (built on first use, so animations play inside)
// following the pointer; letting go fades it out. On touch the lens sits above
// the finger and the page holds still while it's up; a finger that moves
// before the hold registers scrolls as usual. Keyboard: Enter or Space opens
// and closes it, arrow keys move it (Shift for bigger steps), Escape closes it.
const MAGNIFY = 2.5;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
document.querySelectorAll(".cs-magnify").forEach((el) => {
  const lens = document.createElement("div");
  lens.className = "cs-lens";
  lens.setAttribute("aria-hidden", "true");
  let view = null;
  let active = false;
  let px = 0, py = 0, lift = 0; // the magnified point, relative to el; lens offset above it

  // The page's dot grid, so the lens can draw it magnified in line
  let grid = el.parentElement;
  while (grid && !getComputedStyle(grid).backgroundImage.includes("dot-grid")) grid = grid.parentElement;
  if (!grid) lens.style.backgroundImage = "none";

  const build = () => {
    view = el.cloneNode(true);
    view.classList.remove("cs-magnify");
    view.classList.add("cs-lens__view");
    ["tabindex", "role", "aria-label"].forEach((a) => view.removeAttribute(a));
    // Sharp at 2.5x: each image loads its largest source, not the one picked for the page
    view.querySelectorAll("img").forEach((img) => {
      img.loading = "eager";
      if (!img.getAttribute("srcset")) return;
      const [best] = img.srcset.split(",").map((c) => c.trim().split(/\s+/))
        .sort((a, b) => parseFloat(b[1]) - parseFloat(a[1]));
      img.removeAttribute("sizes");
      img.removeAttribute("srcset");
      img.src = best[0];
    });
    lens.append(view);
    document.body.append(lens);
  };

  const render = () => {
    const r = el.getBoundingClientRect();
    const R = lens.offsetWidth / 2;
    view.style.width = `${r.width}px`;
    view.style.transform = `translate(${R - px * MAGNIFY}px, ${R - py * MAGNIFY}px) scale(${MAGNIFY})`;
    lens.style.translate = `${r.left + px}px ${Math.max(R + 8, r.top + py - lift)}px`;
    if (grid) {
      const g = grid.getBoundingClientRect();
      lens.style.backgroundPosition = `${R + (g.left - r.left - px) * MAGNIFY}px ${R + (g.top - r.top - py) * MAGNIFY}px`;
    }
  };

  const open = (touch) => {
    if (!view) build();
    lift = touch ? lens.offsetWidth / 2 + 36 : 0;
    active = true;
    el.classList.add("is-magnifying");
  };
  const moveTo = (x, y) => {
    const r = el.getBoundingClientRect();
    px = clamp(x - r.left, 0, r.width);
    py = clamp(y - r.top, 0, r.height);
    render();
    lens.classList.add("is-open");
  };
  const close = () => {
    active = false;
    el.classList.remove("is-magnifying");
    lens.classList.remove("is-open");
  };

  // Mouse and pen: open on press, follow, close on release
  el.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch" || e.button !== 0) return;
    e.preventDefault(); // no text selection or image drag
    el.setPointerCapture(e.pointerId);
    open(false);
    moveTo(e.clientX, e.clientY);
  });
  el.addEventListener("pointermove", (e) => {
    if (active && e.pointerType !== "touch") moveTo(e.clientX, e.clientY);
  });
  ["pointerup", "pointercancel"].forEach((type) => el.addEventListener(type, (e) => {
    if (active && e.pointerType !== "touch") close();
  }));

  // Touch: a still finger for 200ms opens it; until then a move is a scroll
  let hold = 0, start = null;
  el.addEventListener("touchstart", (e) => {
    clearTimeout(hold);
    if (e.touches.length > 1) return close();
    const t = e.touches[0];
    start = { x: t.clientX, y: t.clientY };
    hold = setTimeout(() => {
      open(true);
      moveTo(start.x, start.y);
    }, 200);
  }, { passive: true });
  el.addEventListener("touchmove", (e) => {
    const t = e.touches[0];
    if (active) {
      e.preventDefault();
      moveTo(t.clientX, t.clientY);
    } else if (start && Math.hypot(t.clientX - start.x, t.clientY - start.y) > 10) {
      clearTimeout(hold);
      start = null;
    }
  }, { passive: false });
  ["touchend", "touchcancel"].forEach((type) => el.addEventListener(type, () => {
    clearTimeout(hold);
    start = null;
    if (active) close();
  }));
  // Android's long-press menu
  el.addEventListener("contextmenu", (e) => active && e.preventDefault());

  el.addEventListener("keydown", (e) => {
    const r = el.getBoundingClientRect();
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (active) return close();
      open(false);
      moveTo(r.left + r.width / 2, r.top + r.height / 2);
    } else if (e.key === "Escape") {
      close();
    } else if (active && e.key.startsWith("Arrow")) {
      e.preventDefault();
      const step = e.shiftKey ? 80 : 20;
      const dx = { ArrowLeft: -step, ArrowRight: step }[e.key] || 0;
      const dy = { ArrowUp: -step, ArrowDown: step }[e.key] || 0;
      moveTo(r.left + px + dx, r.top + py + dy);
    }
  });
  el.addEventListener("blur", close);
  addEventListener("scroll", () => active && render(), { passive: true });
  addEventListener("resize", () => active && render());
});

// Silent loops: play while on screen; a click pauses / plays. Once paused by
// a click they stay paused. With reduced motion they wait paused until clicked.
document.querySelectorAll(".cs-loop").forEach((player) => {
  const video = player.querySelector("video");
  const badge = player.querySelector(".cs-video__badge");
  const name = player.dataset.label || "case study recording";
  let held = false;

  const update = () => {
    const [icon, label] = video.paused ? ["play", "Play"] : ["pause", "Pause"];
    badge.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[icon]}</svg>${label}`;
    player.setAttribute("aria-label", `${label}: ${name}`);
  };

  player.addEventListener("click", () => {
    if (video.paused) {
      held = false;
      video.play().catch(() => {});
    } else {
      held = true;
      video.pause();
    }
  });
  ["play", "pause"].forEach((e) => video.addEventListener(e, update));
  update();

  if (reduceMotion) return;
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      if (!held) video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, { threshold: 0.25 }).observe(player);
});

document.querySelectorAll(".cs-video__btn").forEach((player) => {
  const video = player.querySelector("video");
  const badge = player.querySelector(".cs-video__badge");
  const name = player.dataset.label || "case study video";
  let tapped = false;

  const update = () => {
    const [icon, label] =
      video.paused ? ["play", "Play"] : video.muted ? ["sound", "Tap for sound"] : ["pause", "Pause"];
    badge.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[icon]}</svg>${label}`;
    player.setAttribute("aria-label", `${label}: ${name}`);
  };

  player.addEventListener("click", () => {
    tapped = true;
    if (video.paused || video.muted) {
      video.muted = false;
      video.play();
    } else {
      video.pause();
    }
  });
  ["play", "pause", "volumechange"].forEach((e) => video.addEventListener(e, update));
  update();

  if (reduceMotion) return;
  // Start (muted) when scrolled into view; pause off screen until tapped.
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      if (video.paused && (!tapped || video.muted)) video.play().catch(() => {});
    } else if (!tapped) {
      video.pause();
    }
  }, { threshold: 0.25 }).observe(player);
});
