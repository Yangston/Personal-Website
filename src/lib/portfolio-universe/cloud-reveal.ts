/** Inline bootstrap: starts against the painted HTML, independently of WebGL. */
export function initializeCloudReveal() {
  const root = document.querySelector<HTMLElement>("[data-cloud-reveal]");
  if (!root || root.dataset.introState) return;
  const state = window as Window & {
    __celestialIntroSeen?: boolean;
    __celestialRevealMounted?: boolean;
  };
  const returningWithinDocument = state.__celestialRevealMounted === true;
  state.__celestialRevealMounted = true;
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const key = "celestial-cloud-reveal-v1";
  let seen = state.__celestialIntroSeen === true;
  try {
    seen ||= sessionStorage.getItem(key) === "seen";
  } catch {
    /* Tab-local memory also works when storage is disabled. */
  }
  const fragment = location.hash.slice(1);
  if (
    seen ||
    returningWithinDocument ||
    motion.matches ||
    (fragment && fragment !== "home") ||
    document.body.dataset.worldMode === "quiet"
  ) {
    root.dataset.introState = "skipped";
    return;
  }
  const markSeen = () => {
    state.__celestialIntroSeen = true;
    try {
      sessionStorage.setItem(key, "seen");
    } catch {
      /* In-memory guard remains available. */
    }
  };
  root.dataset.introState = "waiting";
  const animations: Animation[] = [];
  let frame = 0;
  let assetTimer = 0;
  let finished = false;
  const complete = (status: "finished" | "skipped") => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(frame);
    clearTimeout(assetTimer);
    animations.forEach((animation) => animation.cancel());
    root.dataset.introState = status;
    document.removeEventListener("pointerdown", finish, true);
    document.removeEventListener("keydown", finish, true);
    document.removeEventListener("astro:before-swap", finish);
    window.removeEventListener("hashchange", finish);
    motion.removeEventListener("change", finish);
  };
  const finish = () => {
    markSeen();
    complete("finished");
  };
  document.addEventListener("pointerdown", finish, true);
  document.addEventListener("keydown", finish, true);
  document.addEventListener("astro:before-swap", finish);
  window.addEventListener("hashchange", finish);
  motion.addEventListener("change", finish);
  const begin = () => {
    if (finished) return;
    clearTimeout(assetTimer);
    markSeen();
    root.dataset.introState = "playing";
    frame = requestAnimationFrame(() => {
      for (const bank of root.querySelectorAll<HTMLElement>(
        "[data-cloud-direction]",
      )) {
        const upper = bank.dataset.cloudDirection === "upper-right";
        const rotation = upper ? "rotate(180deg)" : "rotate(0deg)";
        const animation = bank.animate(
          [
            { transform: `translate3d(0,0,0) ${rotation}`, opacity: 1 },
            {
              transform: `translate3d(${upper ? 66 : -66}vw,${upper ? -68 : 68}vh,0) ${rotation}`,
              opacity: 0,
            },
          ],
          {
            duration: 1600,
            easing: "cubic-bezier(0.65,0,0.35,1)",
            fill: "forwards",
          },
        );
        animations.push(animation);
      }
      void Promise.all(
        animations.map((animation) =>
          animation.finished.catch(() => undefined),
        ),
      ).then(finish);
    });
  };
  // Decode only the two curtain assets. Navigation is already live; slow or
  // missing imagery releases the veil within 1.5 seconds without consuming it.
  assetTimer = window.setTimeout(() => complete("skipped"), 1500);
  const banks = [
    ...root.querySelectorAll<HTMLImageElement>("[data-cloud-direction]"),
  ];
  void Promise.all(
    banks.map((bank) =>
      bank.decode().then(
        () => bank.naturalWidth > 0,
        () => false,
      ),
    ),
  ).then((ready) => {
    if (ready.length === 2 && ready.every(Boolean)) begin();
    else complete("skipped");
  });
}
