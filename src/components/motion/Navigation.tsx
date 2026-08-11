import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  m,
  useReducedMotion,
} from "motion/react";
import { useEffect, useState, useSyncExternalStore } from "react";

const subscribeToHydration = () => () => {};

type Item = { readonly label: string; readonly href: string };

export default function Navigation({
  currentPath,
  items,
}: {
  currentPath: string;
  items: readonly Item[];
}) {
  const [open, setOpen] = useState(false);
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) =>
      event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <LazyMotion features={domAnimation} strict>
      <header
        data-hydrated={hydrated ? "true" : "false"}
        className="sticky top-0 z-50 border-b border-ink/20 bg-paper/90 backdrop-blur-xl"
      >
        <nav
          aria-label="Primary"
          className="flex h-18 items-center justify-between px-[var(--page-gutter)] md:h-22"
        >
          <a
            href="/"
            aria-label="Stone Yang, home"
            className="font-display text-3xl font-semibold tracking-[-.08em] md:text-4xl"
          >
            SY
          </a>
          <ul className="hidden items-center gap-8 md:flex">
            {items.map((item, index) => {
              const active =
                item.href === "/"
                  ? currentPath === "/"
                  : currentPath.startsWith(item.href);
              return (
                <li key={item.href}>
                  <m.a
                    whileHover={reduce ? undefined : { y: -3 }}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className="group flex items-baseline gap-2 text-sm font-semibold uppercase tracking-[.12em]"
                  >
                    <span className="text-[10px] text-signal">
                      0{index + 1}
                    </span>
                    <span
                      className={
                        active
                          ? "underline decoration-2 underline-offset-6"
                          : ""
                      }
                    >
                      {item.label}
                    </span>
                  </m.a>
                </li>
              );
            })}
          </ul>
          <button
            className="relative z-20 grid size-11 place-items-center border border-ink disabled:opacity-60 md:hidden"
            type="button"
            disabled={!hydrated}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close navigation" : "Open navigation"}
            onClick={() => setOpen((value) => !value)}
          >
            <span aria-hidden="true" className="text-xl">
              {open ? "×" : "≡"}
            </span>
          </button>
        </nav>
        <AnimatePresence>
          {open && (
            <m.div
              id="mobile-menu"
              initial={reduce ? false : { clipPath: "inset(0 0 100% 0)" }}
              animate={{ clipPath: "inset(0 0 0% 0)" }}
              exit={reduce ? undefined : { clipPath: "inset(0 0 100% 0)" }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-x-0 top-full border-b border-ink bg-cobalt px-[var(--page-gutter)] py-10 text-paper md:hidden"
            >
              <ul className="space-y-4">
                {items.map((item, index) => (
                  <li key={item.href}>
                    <a
                      onClick={() => setOpen(false)}
                      className="flex items-baseline gap-4 font-display text-5xl"
                      href={item.href}
                    >
                      <span className="font-sans text-xs">0{index + 1}</span>
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </m.div>
          )}
        </AnimatePresence>
      </header>
    </LazyMotion>
  );
}
