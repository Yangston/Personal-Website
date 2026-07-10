import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

export type GalleryMedia = {
  type: "image" | "video";
  src: string;
  width: number;
  height: number;
  alt: string;
  caption?: string;
  poster?: string;
  layout: "full" | "wide" | "portrait" | "inset" | "pair";
};

const spans: Record<GalleryMedia["layout"], string> = {
  full: "col-span-6 md:col-span-12",
  wide: "col-span-6 md:col-span-8 md:col-start-3",
  portrait: "col-span-5 md:col-span-5",
  inset: "col-span-4 col-start-2 md:col-span-4 md:col-start-5",
  pair: "col-span-3 md:col-span-6"
};

export default function MediaGallery({ media, presentation }: { media: GalleryMedia[]; presentation: string }) {
  const [active, setActive] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const reduce = useReducedMotion();
  const closeButton = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  const open = (index: number) => {
    previousFocus.current = document.activeElement as HTMLElement;
    setActive(index);
  };
  const close = () => setActive(null);
  const step = (amount: number) => setActive((value) => value === null ? null : (value + amount + media.length) % media.length);

  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (active === null) { previousFocus.current?.focus(); return; }
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active]);

  return (
    <LazyMotion features={domAnimation} strict>
      <div data-gallery-ready={hydrated ? "true" : "false"} className={`page-grid py-12 md:py-24 presentation-${presentation}`}>
        {media.map((item, index) => (
          <m.figure
            key={`${item.src}-${index}`}
            initial={reduce ? false : { opacity: 0, y: 45, rotate: index % 2 ? 1.2 : -1.2 }}
            whileInView={{ opacity: 1, y: 0, rotate: 0 }}
            viewport={{ once: true, margin: "-8%" }}
            transition={{ duration: .8, ease: [0.16, 1, 0.3, 1] }}
            className={`${spans[item.layout]} my-4 md:my-14 ${presentation === "film-strip" ? "border-8 border-ink bg-ink p-1 text-paper" : ""}`}
          >
            {item.type === "image" ? (
              <button disabled={!hydrated} type="button" onClick={() => open(index)} className="group relative block w-full cursor-zoom-in overflow-hidden text-left disabled:cursor-wait" aria-label={`Open image: ${item.alt}`}>
                <img src={item.src} width={item.width} height={item.height} alt={item.alt} loading="lazy" className="h-auto w-full transition duration-700 group-hover:scale-[1.015]" />
                <span aria-hidden="true" className="absolute bottom-3 right-3 grid size-10 bg-paper text-ink opacity-0 transition group-hover:opacity-100">＋</span>
              </button>
            ) : (
              <video controls playsInline preload="metadata" poster={item.poster} width={item.width} height={item.height} aria-label={item.alt} className="w-full"><source src={item.src} /></video>
            )}
            {item.caption && <figcaption className="mt-3 max-w-lg text-xs font-medium uppercase tracking-wider">{item.caption}</figcaption>}
          </m.figure>
        ))}
      </div>
      <AnimatePresence>
        {active !== null && media[active]?.type === "image" && (
          <m.div
            role="dialog"
            aria-modal="true"
            aria-label="Image lightbox"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] grid place-items-center bg-ink/95 p-4 text-paper md:p-12"
          >
            <button ref={closeButton} type="button" onClick={close} aria-label="Close lightbox" className="absolute right-4 top-4 z-10 grid size-12 place-items-center border border-paper text-2xl md:right-8 md:top-8">×</button>
            <button type="button" onClick={() => step(-1)} aria-label="Previous image" className="absolute left-3 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center bg-paper text-ink md:left-8">←</button>
            <m.img
              key={media[active].src}
              initial={reduce ? false : { opacity: 0, scale: .96 }}
              animate={{ opacity: 1, scale: 1 }}
              src={media[active].src}
              width={media[active].width}
              height={media[active].height}
              alt={media[active].alt}
              className="max-h-[82vh] max-w-[88vw] object-contain"
            />
            <button type="button" onClick={() => step(1)} aria-label="Next image" className="absolute right-3 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center bg-paper text-ink md:right-8">→</button>
            <p className="absolute bottom-4 left-1/2 w-[80vw] -translate-x-1/2 text-center text-xs uppercase tracking-widest">{media[active].caption ?? media[active].alt}</p>
          </m.div>
        )}
      </AnimatePresence>
    </LazyMotion>
  );
}
