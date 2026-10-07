// Page transition between the portfolio and the case studies (trial).
// Leaving: the page slides about half a screen (slower than the panel, for a
// parallax feel) and fades while a dark panel wipes over it.
// Arriving: the panel carries on off the screen while the new page slides
// and fades into place. Upward into a case study, downward back out.
// Load this in <head> on every page that takes part.
(() => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // The mask runs at twice the original 900ms speed. Arriving, the page
  // keeps sliding and fading in after the mask has cleared, so the reveal
  // reads as two staggered layers: the mask, then the content.
  const MASK = 450;
  const PAGE_DELAY = 200;
  const PAGE_IN = 600;
  const KEY = "page-transition";
  // Remembered scroll positions, keyed so "/" and "/index.html" match
  const scrollKey = (path) => "page-transition-scroll:" + path.replace(/index\.html$/, "");
  const root = document.documentElement;

  // Mask and page share a strong ease-in-out curve; the fade runs on a
  // gentler one so content dims as it starts moving and settles in last.
  const MOVE = "cubic-bezier(.76, 0, .24, 1)";
  const FADE = "cubic-bezier(.45, 0, .55, 1)";
  // Arriving content: quick start, long soft landing after the mask is gone
  const SETTLE = "cubic-bezier(.33, 1, .68, 1)";
  const style = document.createElement("style");
  style.textContent = `
    html.pt-enter::after,
    html.pt-exit::after {
      content: "";
      position: fixed;
      inset: 0;
      z-index: 10000;
      background: var(--color-bg-dark, #1d1f20);
      pointer-events: none;
    }
    html.pt-exit::after { animation: pt-panel-in ${MASK}ms ${MOVE} both; }
    html.pt-enter::after { animation: pt-panel-out ${MASK}ms ${MOVE} both; }
    html.pt-exit body { animation: pt-page-out ${MASK}ms ${MOVE} both, pt-fade-out ${MASK}ms ${FADE} both; }
    html.pt-enter body { animation: pt-page-in ${PAGE_IN}ms ${SETTLE} ${PAGE_DELAY}ms both, pt-fade-in ${PAGE_IN}ms ${SETTLE} ${PAGE_DELAY}ms both; }
    html.pt-enter, html.pt-exit { overflow-x: hidden; }
    /* --pt-dir: 1 moves everything up (into a case study), -1 down (back) */
    @keyframes pt-panel-in { from { transform: translateY(calc(var(--pt-dir, 1) * 100%)); } to { transform: none; } }
    @keyframes pt-panel-out { to { transform: translateY(calc(var(--pt-dir, 1) * -100%)); } }
    @keyframes pt-page-out { to { transform: translateY(calc(var(--pt-dir, 1) * -55vh)); } }
    @keyframes pt-page-in { from { transform: translateY(calc(var(--pt-dir, 1) * 55vh)); } }
    @keyframes pt-fade-out { to { opacity: 0; } }
    @keyframes pt-fade-in { from { opacity: 0; } }
  `;
  document.head.append(style);
  const setDir = (dir) => root.style.setProperty("--pt-dir", dir === "down" ? "-1" : "1");

  // Arriving from a transition: start covered, then reveal
  let arriving = null;
  try {
    arriving = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch {}
  if (arriving) {
    setDir(arriving);
    // Back on the portfolio: return to where the visitor left it, instead of
    // scrolling down from the top through the tablet intro again
    let saved = null;
    try { saved = sessionStorage.getItem(scrollKey(location.pathname)); } catch {}
    if (arriving === "down" && saved !== null) {
      history.scrollRestoration = "manual";
      document.addEventListener("DOMContentLoaded", () => {
        root.style.scrollBehavior = "auto";
        scrollTo(0, +saved);
        root.style.scrollBehavior = "";
      });
    }
    root.classList.add("pt-enter");
    setTimeout(() => {
      root.classList.remove("pt-enter");
      // Scroll-linked effects measured positions while the page was offset
      window.ScrollTrigger?.refresh();
    }, PAGE_DELAY + PAGE_IN + 50);
  }

  // Leaving: links to other pages on this site. Into a case study the
  // motion runs upward; back out to the portfolio it runs downward.
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
      // Going back to a remembered spot: skip the link's #anchor scroll
      if (dir === "down" && sessionStorage.getItem(scrollKey(url.pathname)) !== null) url.hash = "";
    } catch {}
    setDir(dir);
    root.classList.remove("pt-enter");
    root.classList.add("pt-exit");
    setTimeout(() => { location.href = url.href; }, MASK);
  });

  // Coming back through the browser's back/forward cache: uncover the page
  addEventListener("pageshow", (e) => {
    if (e.persisted) root.classList.remove("pt-exit");
  });
})();
