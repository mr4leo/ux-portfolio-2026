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
