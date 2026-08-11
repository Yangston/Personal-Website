import { LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";

export default function AnimatedRule({
  className = "",
}: {
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <LazyMotion features={domAnimation} strict>
      <m.hr
        initial={reduce ? false : { scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className={`origin-left border-0 border-t border-current ${className}`}
      />
    </LazyMotion>
  );
}
