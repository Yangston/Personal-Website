/** Hover previews never intercept the constellation's native navigation. */
export function createProjectPreviews(root: HTMLElement) {
  const field = root.querySelector<HTMLElement>("#projects");
  if (!field) return { reset() {}, destroy() {} };
  const panels = [
    ...field.querySelectorAll<HTMLElement>("[data-project-preview]"),
  ];
  const coarse = matchMedia("(hover: none), (pointer: coarse)");
  let active: string | null = null;
  let pinned = false;
  let restoringFocus = false;
  let pointerFocus = false;
  let destroyed = false;
  let layoutFrame = 0;
  const positionInfo = () => {
    cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = 0;
      if (
        destroyed ||
        field.dataset.sceneActive !== "true" ||
        root.hasAttribute("data-transition-phase")
      )
        return;
      // Read projected label boxes only on layout changes, never in the render loop.
      const placements = [
        ...field.querySelectorAll<HTMLElement>("[data-project-id]"),
      ].map((node) => {
        const label = node.querySelector<HTMLElement>(
          ".project-constellation-copy",
        )!;
        const button = node.querySelector<HTMLElement>("[data-project-info]")!;
        const bounds = node.getBoundingClientRect();
        const copy = label.getBoundingClientRect();
        const above = copy.bottom <= bounds.top;
        return {
          button,
          left:
            Math.max(
              8,
              Math.min(
                innerWidth - 52,
                above ? copy.right + 4 : copy.left + copy.width / 2 - 22,
              ),
            ) - bounds.left,
          top:
            (above ? copy.top + (copy.height - 44) / 2 : copy.bottom + 6) -
            bounds.top,
        };
      });
      for (const { button, left, top } of placements) {
        button.style.left = `${left.toFixed(2)}px`;
        button.style.top = `${top.toFixed(2)}px`;
        button.dataset.infoReady = "true";
      }
    });
  };
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  const idFor = (target: EventTarget | null) =>
    target instanceof Element
      ? (target.closest<HTMLElement>(
          "[data-project-id], [data-project-preview]",
        )?.dataset.projectId ??
        target.closest<HTMLElement>("[data-project-preview]")?.dataset
          .projectPreview)
      : undefined;
  const show = (id: string | null) => {
    clearTimeout(closeTimer);
    active = id;
    for (const panel of panels)
      panel.hidden = panel.dataset.projectPreview !== id;
    for (const button of field.querySelectorAll<HTMLElement>(
      "[data-project-info]",
    ))
      button.setAttribute(
        "aria-expanded",
        String(button.dataset.projectInfo === id),
      );
    field.dataset.previewOpen = id ?? "";
  };
  const reset = () => {
    pinned = false;
    show(null);
  };
  const enter = (event: Event) => {
    if (
      restoringFocus ||
      (coarse.matches && (pointerFocus || event.type === "pointerover"))
    )
      return;
    const id = idFor(event.target);
    if (id) {
      pinned = false;
      show(id);
    }
  };
  const leave = (event: MouseEvent | FocusEvent) => {
    if (!idFor(event.target) || (coarse.matches && pointerFocus)) return;
    if (
      pinned ||
      restoringFocus ||
      (event.type === "pointerout" && coarse.matches)
    )
      return;
    const next = idFor(event.relatedTarget);
    if (next) {
      show(next);
      return;
    }
    // A small bridge lets the pointer cross the gap to the side preview.
    closeTimer = setTimeout(() => {
      if (!idFor(document.activeElement)) show(null);
    }, 220);
  };
  const click = (event: MouseEvent) => {
    pointerFocus = false;
    const target = event.target instanceof Element ? event.target : null;
    const info = target?.closest<HTMLElement>("[data-project-info]");
    if (info) {
      const id = info.dataset.projectInfo!;
      if (active === id && pinned) reset();
      else {
        show(id);
        pinned = true;
      }
    }
    if (target?.closest("[data-preview-close]")) {
      const opener = field.querySelector<HTMLElement>(
        coarse.matches
          ? `[data-project-info="${active}"]`
          : `[data-project-id="${active}"] [data-project-constellation]`,
      );
      restoringFocus = true;
      reset();
      opener?.focus({ preventScroll: true });
      restoringFocus = false;
    }
  };
  const key = (event: KeyboardEvent) => {
    pointerFocus = false;
    if (event.key === "Escape" && active) {
      event.preventDefault();
      const opener = field.querySelector<HTMLElement>(
        coarse.matches
          ? `[data-project-info="${active}"]`
          : `[data-project-id="${active}"] [data-project-constellation]`,
      );
      const inPanel = panels.some((panel) =>
        panel.contains(document.activeElement),
      );
      restoringFocus = true;
      reset();
      if (inPanel) opener?.focus({ preventScroll: true });
      restoringFocus = false;
    }
  };
  const changed = () => {
    if (field.dataset.sceneActive !== "true") reset();
    positionInfo();
  };
  const observer = new MutationObserver(changed);
  observer.observe(field, {
    attributes: true,
    attributeFilter: ["data-scene-active"],
  });
  observer.observe(root, {
    attributes: true,
    attributeFilter: ["data-transition-phase"],
  });
  const resizeObserver = new ResizeObserver(positionInfo);
  field
    .querySelectorAll(".project-constellation-copy")
    .forEach((label) => resizeObserver.observe(label));
  window.addEventListener("resize", positionInfo);
  coarse.addEventListener("change", positionInfo);
  void document.fonts.ready.then(() => {
    if (!destroyed) positionInfo();
  });
  positionInfo();
  const pointerDown = () => {
    pointerFocus = true;
  };
  const pointerCancel = () => {
    pointerFocus = false;
  };
  field.addEventListener("pointerdown", pointerDown);
  field.addEventListener("pointercancel", pointerCancel);
  field.addEventListener("pointerover", enter);
  field.addEventListener("focusin", enter);
  field.addEventListener("pointerout", leave);
  field.addEventListener("focusout", leave);
  field.addEventListener("click", click);
  field.addEventListener("keydown", key);
  return {
    reset,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(layoutFrame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", positionInfo);
      coarse.removeEventListener("change", positionInfo);
      reset();
      observer.disconnect();
      field.removeEventListener("pointerdown", pointerDown);
      field.removeEventListener("pointercancel", pointerCancel);
      field.removeEventListener("pointerover", enter);
      field.removeEventListener("focusin", enter);
      field.removeEventListener("pointerout", leave);
      field.removeEventListener("focusout", leave);
      field.removeEventListener("click", click);
      field.removeEventListener("keydown", key);
    },
  };
}
