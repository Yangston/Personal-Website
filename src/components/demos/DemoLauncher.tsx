import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import { useState } from "react";
import { demoRegistry, type NativeDemoId } from "./registry";

type Demo =
  | { type: "native"; id: string }
  | { type: "iframe"; url: string; title: string }
  | { type: "external"; url: string }
  | { type: "none" };

export default function DemoLauncher({ demo }: { demo: Demo }) {
  const [launched, setLaunched] = useState(false);
  const reduce = useReducedMotion();
  if (demo.type === "none") return null;
  if (demo.type === "external") return <a className="inline-flex bg-cobalt px-5 py-3 font-bold uppercase tracking-wider text-white" href={demo.url} target="_blank" rel="noreferrer">Open live project ↗</a>;
  const NativeDemo = demo.type === "native" ? demoRegistry[demo.id as NativeDemoId] : null;

  return (
    <LazyMotion features={domAnimation} strict>
      <section className="border-y border-ink py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow text-signal">Interactive demo</p><h2 className="font-display text-5xl md:text-7xl">Try it here.</h2></div>{!launched && <button className="bg-ink px-6 py-4 font-bold uppercase tracking-wider text-paper" type="button" onClick={() => setLaunched(true)}>Launch demo</button>}</div>
        <AnimatePresence>
          {launched && (
            <m.div initial={reduce ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0 }} className="overflow-hidden">
              {demo.type === "native" && NativeDemo && <NativeDemo />}
              {demo.type === "native" && !NativeDemo && <p className="bg-signal p-4 font-bold">This demo is not registered yet.</p>}
              {demo.type === "iframe" && <><iframe src={demo.url} title={demo.title} loading="lazy" sandbox="allow-scripts allow-forms allow-popups allow-same-origin" referrerPolicy="strict-origin-when-cross-origin" className="aspect-video w-full border-0 bg-white" /><p className="mt-3 text-sm">If the embedded demo is unavailable, <a className="underline" href={demo.url} target="_blank" rel="noreferrer">open it in a new tab</a>.</p></>}
            </m.div>
          )}
        </AnimatePresence>
      </section>
    </LazyMotion>
  );
}
