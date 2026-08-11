import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  m,
  useReducedMotion,
} from "motion/react";
import { useState } from "react";
import { demoRegistry, type NativeDemoId } from "./registry";

type Demo =
  | { type: "native"; id: string }
  | { type: "iframe"; url: string; title: string }
  | { type: "external"; url: string }
  | { type: "none" };

export default function DemoLauncher({
  demo,
  tone = "light",
}: {
  demo: Demo;
  tone?: "light" | "cosmic";
}) {
  const [launched, setLaunched] = useState(false);
  const reduce = useReducedMotion();
  const cosmic = tone === "cosmic";
  if (demo.type === "none") return null;
  if (demo.type === "external")
    return (
      <a
        className={
          cosmic
            ? "inline-flex bg-moss px-5 py-3 font-bold uppercase tracking-wider text-ink"
            : "inline-flex bg-cobalt px-5 py-3 font-bold uppercase tracking-wider text-white"
        }
        href={demo.url}
        target="_blank"
        rel="noreferrer"
      >
        Open project ↗
      </a>
    );
  const NativeDemo =
    demo.type === "native" ? demoRegistry[demo.id as NativeDemoId] : null;

  return (
    <LazyMotion features={domAnimation} strict>
      <section
        className={
          cosmic
            ? "border-y border-paper/20 py-8 text-paper"
            : "border-y border-ink py-8"
        }
      >
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p
              className={cosmic ? "eyebrow text-signal" : "eyebrow text-signal"}
            >
              Field demonstration
            </p>
            <h2 className="font-display text-5xl md:text-7xl">
              See it in motion.
            </h2>
          </div>
          {!launched && (
            <button
              className={
                cosmic
                  ? "bg-moss px-6 py-4 font-bold uppercase tracking-wider text-ink"
                  : "bg-ink px-6 py-4 font-bold uppercase tracking-wider text-paper"
              }
              type="button"
              onClick={() => setLaunched(true)}
            >
              Launch demonstration
            </button>
          )}
        </div>
        <AnimatePresence>
          {launched && (
            <m.div
              initial={reduce ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0 }}
              className="overflow-hidden"
            >
              {demo.type === "native" && NativeDemo && <NativeDemo />}
              {demo.type === "native" && !NativeDemo && (
                <p className="bg-signal p-4 font-bold">
                  This demo is not registered yet.
                </p>
              )}
              {demo.type === "iframe" && (
                <>
                  <iframe
                    src={demo.url}
                    title={demo.title}
                    loading="lazy"
                    sandbox="allow-scripts allow-forms allow-popups allow-same-origin allow-presentation"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allow="encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                    className="aspect-video w-full border-0 bg-black"
                  />
                  <p
                    className={
                      cosmic ? "mt-3 text-sm text-paper/65" : "mt-3 text-sm"
                    }
                  >
                    If the embedded demonstration is unavailable,{" "}
                    <a
                      className={cosmic ? "text-moss underline" : "underline"}
                      href={demo.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      open it in a new tab
                    </a>
                    .
                  </p>
                </>
              )}
            </m.div>
          )}
        </AnimatePresence>
      </section>
    </LazyMotion>
  );
}
