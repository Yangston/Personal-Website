export type ScenePanels = Readonly<{
  open: (id: string, trigger?: HTMLElement) => void;
  close: (restoreFocus?: boolean) => void;
  destroy: () => void;
}>;

/** One shared detail panel, with native modal focus containment on small screens. */
export function createScenePanels(
  root: HTMLElement,
  onChange?: (id: string | null) => void,
): ScenePanels {
  const panels = new Map(
    [
      ...root.querySelectorAll<HTMLDialogElement>("dialog[data-scene-panel]"),
    ].map((panel) => [panel.dataset.scenePanel ?? panel.id, panel] as const),
  );
  if (
    !panels.size ||
    typeof HTMLDialogElement.prototype.showModal !== "function"
  )
    return { open() {}, close() {}, destroy() {} };

  const sheetPreference = matchMedia("(max-width: 700px)");
  const cleanup: Array<() => void> = [];
  const triggers = [
    ...root.querySelectorAll<HTMLElement>("[data-scene-panel-trigger]"),
  ];
  let active: HTMLDialogElement | null = null;
  let opener: HTMLElement | null = null;
  let destroyed = false;

  for (const panel of panels.values()) {
    const placeholder = document.createComment(`scene-panel:${panel.id}`);
    panel.before(placeholder);
    root.append(panel);
    cleanup.push(() => placeholder.replaceWith(panel));
  }

  for (const trigger of triggers) {
    const panel = panels.get(trigger.dataset.scenePanelTrigger ?? "");
    if (!panel) continue;
    const attributes = [
      "role",
      "aria-haspopup",
      "aria-controls",
      "aria-expanded",
    ];
    const original = attributes.map(
      (name) => [name, trigger.getAttribute(name)] as const,
    );
    if (trigger instanceof HTMLAnchorElement)
      trigger.setAttribute("role", "button");
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-controls", panel.id);
    trigger.setAttribute("aria-expanded", "false");
    cleanup.push(() => {
      for (const [name, value] of original)
        if (value === null) trigger.removeAttribute(name);
        else trigger.setAttribute(name, value);
    });
  }

  const setExpanded = (id: string | null) => {
    for (const trigger of triggers)
      if (panels.has(trigger.dataset.scenePanelTrigger ?? ""))
        trigger.setAttribute(
          "aria-expanded",
          String(trigger.dataset.scenePanelTrigger === id),
        );
  };

  const close = (restoreFocus = true) => {
    const panel = active;
    const previousOpener = opener;
    active = null;
    opener = null;
    delete root.dataset.scenePanelOpen;
    if (panel) onChange?.(null);
    setExpanded(null);
    if (panel?.open) panel.close();
    if (
      restoreFocus &&
      previousOpener?.isConnected &&
      !previousOpener.closest("[inert]")
    )
      previousOpener.focus({ preventScroll: true });
  };

  const show = (panel: HTMLDialogElement) => {
    const modal = sheetPreference.matches;
    panel.dataset.scenePanelMode = modal ? "sheet" : "side";
    panel.setAttribute("aria-modal", String(modal));
    if (modal) panel.showModal();
    else panel.show();
    panel
      .querySelector<HTMLElement>("[data-scene-panel-heading]")
      ?.focus({ preventScroll: true });
  };

  const open = (id: string, trigger?: HTMLElement) => {
    const panel = panels.get(id);
    if (destroyed || !panel) return;
    if (active === panel) {
      panel
        .querySelector<HTMLElement>("[data-scene-panel-heading]")
        ?.focus({ preventScroll: true });
      return;
    }
    close(false);
    opener =
      trigger ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);
    active = panel;
    root.dataset.scenePanelOpen = id;
    onChange?.(id);
    setExpanded(id);
    show(panel);
  };

  const onClick = (event: MouseEvent) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    )
      return;
    const target = event.target instanceof Element ? event.target : null;
    if (
      target?.closest("[data-scene-panel-close]")?.closest("dialog") === active
    ) {
      event.preventDefault();
      close();
      return;
    }
    const trigger = target?.closest<HTMLElement>("[data-scene-panel-trigger]");
    const id = trigger?.dataset.scenePanelTrigger;
    if (!trigger || !id || !panels.has(id)) return;
    if (
      trigger instanceof HTMLAnchorElement &&
      (trigger.hasAttribute("download") ||
        (trigger.target && trigger.target !== "_self"))
    )
      return;
    event.preventDefault();
    open(id, trigger);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Tab" && active?.matches(":modal")) {
      const focusable = [
        ...active.querySelectorAll<HTMLElement>(
          "a[href], area[href], button, input, select, textarea, summary, iframe, [contenteditable], [tabindex]",
        ),
      ].filter(
        (element) =>
          element.tabIndex >= 0 &&
          !element.matches(":disabled") &&
          !element.closest("[inert], [hidden]") &&
          element.getClientRects().length > 0 &&
          getComputedStyle(element).visibility === "visible",
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      const focused = document.activeElement;
      if (!first) {
        event.preventDefault();
        active
          .querySelector<HTMLElement>("[data-scene-panel-heading]")
          ?.focus({ preventScroll: true });
      } else if (
        event.shiftKey &&
        (focused === first || !focusable.some((element) => element === focused))
      ) {
        event.preventDefault();
        last?.focus({ preventScroll: true });
      } else if (
        !event.shiftKey &&
        (focused === last || !active.contains(focused))
      ) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
      return;
    }
    if (event.key === "Escape" && active) {
      event.preventDefault();
      close();
      return;
    }
    if (
      event.key !== " " ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    )
      return;
    const trigger =
      event.target instanceof HTMLAnchorElement ? event.target : null;
    const id = trigger?.dataset.scenePanelTrigger;
    if (!trigger || !id || !panels.has(id)) return;
    event.preventDefault();
    open(id, trigger);
  };

  const onBreakpointChange = () => {
    if (!active) return;
    const panel = active;
    panel.close();
    show(panel);
  };

  for (const panel of panels.values()) {
    const onCancel = (event: Event) => {
      event.preventDefault();
      if (panel === active) close();
    };
    const onClose = () => {
      // Native close events are queued; ignore the event from a breakpoint reopen.
      if (panel === active && !panel.open) close();
    };
    panel.addEventListener("cancel", onCancel);
    panel.addEventListener("close", onClose);
    cleanup.push(() => {
      panel.removeEventListener("cancel", onCancel);
      panel.removeEventListener("close", onClose);
    });
  }
  root.addEventListener("click", onClick);
  document.addEventListener("keydown", onKeyDown);
  sheetPreference.addEventListener("change", onBreakpointChange);
  root.dataset.scenePanels = "ready";

  return {
    open,
    close,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      close(false);
      root.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeyDown);
      sheetPreference.removeEventListener("change", onBreakpointChange);
      cleanup.reverse().forEach((dispose) => dispose());
      delete root.dataset.scenePanels;
    },
  };
}
