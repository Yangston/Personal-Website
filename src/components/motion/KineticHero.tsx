import { LazyMotion, domAnimation, m, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

export default function KineticHero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const driftUp = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -90]);
  const driftDown = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 130]);
  const words = ["Engineer", "Photographer", "Builder"];

  return (
    <LazyMotion features={domAnimation} strict>
      <section ref={ref} className="relative min-h-[calc(100svh-4.5rem)] overflow-hidden border-b border-ink/20 px-[var(--page-gutter)] py-12 md:min-h-[calc(100svh-5.5rem)] md:py-16">
        <m.div style={{ y: driftDown }} aria-hidden="true" className="absolute -right-[8vw] top-[12%] size-[clamp(13rem,36vw,36rem)] rotate-12 rounded-full border-[clamp(1.5rem,5vw,5rem)] border-cobalt mix-blend-multiply" />
        <m.div style={{ y: driftUp }} aria-hidden="true" className="absolute bottom-[7%] left-[46%] h-[42%] w-[10%] -rotate-[28deg] bg-signal mix-blend-multiply" />
        <div className="relative z-10 flex min-h-[75svh] flex-col justify-between">
          <p className="eyebrow flex items-center gap-3"><span className="inline-block size-2 rounded-full bg-signal" />Portfolio / Vancouver</p>
          <div>
            <div className="overflow-hidden pb-3">
              <m.h1
                initial={reduce ? false : { y: "110%", rotate: 3 }}
                animate={{ y: 0, rotate: 0 }}
                transition={{ duration: .9, ease: [0.16, 1, 0.3, 1] }}
                className="font-display text-[clamp(5.5rem,19vw,18rem)] font-semibold leading-[.66] tracking-[-.09em]"
              >Stone</m.h1>
            </div>
            <div className="flex items-end justify-between gap-4 overflow-hidden pb-4">
              <m.h1
                initial={reduce ? false : { y: "110%", rotate: -3 }}
                animate={{ y: 0, rotate: 0 }}
                transition={{ duration: .9, delay: .08, ease: [0.16, 1, 0.3, 1] }}
                className="ml-[8vw] font-display text-[clamp(5.5rem,19vw,18rem)] font-semibold leading-[.66] tracking-[-.09em]"
              >Yang</m.h1>
              <span aria-hidden="true" className="mb-1 hidden text-5xl text-cobalt md:block">↘</span>
            </div>
          </div>
          <div className="grid gap-8 border-t border-ink pt-5 md:grid-cols-2">
            <p className="max-w-xl text-lg font-medium leading-tight md:text-2xl">I build intelligent systems and collect the strange, quiet moments around them.</p>
            <ul className="flex flex-wrap items-end gap-x-5 gap-y-1 md:justify-end">
              {words.map((word, index) => (
                <m.li key={word} initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .35 + index * .1 }} className="font-display text-2xl italic md:text-3xl">{word}{index < 2 ? "," : "."}</m.li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </LazyMotion>
  );
}
