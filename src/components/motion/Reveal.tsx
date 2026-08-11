import { LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import type { PropsWithChildren } from "react";

export default function Reveal({
  children,
  className = "",
  delay = 0,
}: PropsWithChildren<{ className?: string; delay?: number }>) {
  const reduce = useReducedMotion();
  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        initial={
          reduce ? false : { opacity: 0, y: 28, clipPath: "inset(0 0 12% 0)" }
        }
        whileInView={{ opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)" }}
        viewport={{ once: true, margin: "-10%" }}
        transition={{
          duration: reduce ? 0 : 0.75,
          delay: reduce ? 0 : delay,
          ease: [0.16, 1, 0.3, 1],
        }}
        className={className}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}
