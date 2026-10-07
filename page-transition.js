// Page transition between the portfolio and the case studies.
// A dark mask wipes across the screen while the page's text and images
// slide and fade on their own, slightly out of step with it:
// Leaving: the elements start first, easing into motion, and the mask
// follows to cover them. Arriving: the mask clears first and the elements
// trail behind it, still easing to a stop once the screen is uncovered.
// Upward into a case study, downward back out to the portfolio.
// Load this in <head> on every page that takes part.
(() => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const MASK = 450; // mask wipe, each way
  const LEAD = 80; // leaving: elements start this long before the mask
  const EL_OUT = 450; // leaving: element slide and fade
  const LAG = 100; // arriving: elements start this long after the mask
  const EL_IN = 600; // arriving: element slide and fade
  const KEY = "page-transition";
  // Remembered scroll positions, keyed so "/" and "/index.html" match
  const scrollKey = (path) => "page-transition-scroll:" + path.replace(/index\.html$/, "");
  const root = document.documentElement;

  const MOVE = "cubic-bezier(.76, 0, .24, 1)"; // mask: strong ease in-out
  const ACCEL = "cubic-bezier(.55, 0, .75, .4)"; // leaving elements: ease into motion
  const SETTLE = "cubic-bezier(.33, 1, .68, 1)"; // arriving elements: soft landing
  const style = document.createElement("style");
  style.textContent = `
    html.pt-cover::after,
    html.pt-enter::after,
    html.pt-exit::after {
      content: "";
      position: fixed;
      inset: 0;
      z-index: 10000;
      background: var(--color-bg-dark, #1d1f20);
      pointer-events: none;
    }
    html.pt-exit::after { animation: pt-mask-in ${MASK}ms ${MOVE} ${LEAD}ms both; }
    html.pt-enter::after { animation: pt-mask-out ${MASK}ms ${MOVE} both; }
    html.pt-exit .pt-el { animation: pt-el-out ${EL_OUT}ms ${ACCEL} both; }
    html.pt-enter .pt-el { animation: pt-el-in ${EL_IN}ms ${SETTLE} ${LAG}ms both; }
    html.pt-cover, html.pt-enter, html.pt-exit { overflow-x: hidden; }
    /* --pt-dir: 1 moves everything up (into a case study), -1 down (back).
       The element keyframes leave out the resting state, so elements land
       on whatever the page's own scripts have set. */
    /* A short slide, so neighbouring text never drifts over each other */
    @keyframes pt-mask-in { from { transform: translateY(calc(var(--pt-dir, 1) * 100%)); } to { transform: none; } }
    @keyframes pt-mask-out { to { transform: translateY(calc(var(--pt-dir, 1) * -100%)); } }
    @keyframes pt-el-out { to { translate: 0 calc(var(--pt-dir, 1) * -60px); opacity: 0; } }
    @keyframes pt-el-in { from { translate: 0 calc(var(--pt-dir, 1) * 60px); opacity: 0; } }
  `;
  document.head.append(style);
  const setDir = (dir) => root.style.setProperty("--pt-dir", dir === "down" ? "-1" : "1");

  // The text and images on screen, outermost only (a figure moves with its
  // image, a link with its icon), so nothing slides twice
  const SEL = "h1, h2, h3, h4, p, li, img, video, svg, picture, canvas, figure, blockquote, a, button, .cs-video, .th-table";
  let tagged = [];
  const tag = () => {
    const all = [...document.body.querySelectorAll(SEL)];
    const set = new Set(all);
    tagged = all.filter((el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        if (set.has(p)) return false;
      }
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.bottom > 0 && r.top < innerHeight;
    });
    tagged.forEach((el) => el.classList.add("pt-el"));
  };
  const untag = () => {
    tagged.forEach((el) => el.classList.remove("pt-el"));
    tagged = [];
  };

  // Arriving from a transition: covered until the page is parsed, then reveal
  let arriving = null;
  try {
    arriving = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch {}
  if (arriving) {
    setDir(arriving);
    root.classList.add("pt-cover");
    // Back on the portfolio: return to where the visitor left it, instead of
    // scrolling down from the top through the tablet intro again
    let saved = null;
    try { saved = sessionStorage.getItem(scrollKey(location.pathname)); } catch {}
    const restore = arriving === "down" && saved !== null;
    if (restore) history.scrollRestoration = "manual";
    document.addEventListener("DOMContentLoaded", () => {
      if (restore) {
        root.style.scrollBehavior = "auto";
        scrollTo(0, +saved);
        root.style.scrollBehavior = "";
      }
      tag();
      root.classList.replace("pt-cover", "pt-enter");
      setTimeout(() => {
        root.classList.remove("pt-enter");
        untag();
        window.ScrollTrigger?.refresh();
      }, LAG + EL_IN + 50);
    });
  }

  // Leaving: links to other pages on this site
  document.addEventListener("click", (e) => {
    const link = e.target.closest?.("a[href]");
    if (!link || e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (link.target && link.target !== "_self") return;
    if (link.hasAttribute("download")) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.pathname === location.pathname) return;
    if (!/(\.html|\/)$/.test(url.pathname)) return;

    e.preventDefault();
    const dir = url.pathname.includes("/case-studies/") ? "up" : "down";
    try {
      sessionStorage.setItem(KEY, dir);
      sessionStorage.setItem(scrollKey(location.pathname), String(scrollY));
      // Home links (the footer monogram) open the home page at the top
      if (link.hasAttribute("data-home")) sessionStorage.removeItem(scrollKey(url.pathname));
      // Going back to a remembered spot: skip the link's #anchor scroll
      if (dir === "down" && sessionStorage.getItem(scrollKey(url.pathname)) !== null) url.hash = "";
    } catch {}
    setDir(dir);
    root.classList.remove("pt-enter");
    untag();
    tag();
    root.classList.add("pt-exit");
    setTimeout(() => { location.href = url.href; }, LEAD + MASK);
  });

  // Coming back through the browser's back/forward cache: uncover the page
  addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    root.classList.remove("pt-exit");
    untag();
  });
})();
