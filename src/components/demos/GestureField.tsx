import { LazyMotion, domAnimation, m, useMotionValue, useReducedMotion, useSpring } from "motion/react";

export default function GestureField() {
  const reduce = useReducedMotion();
  const x = useSpring(useMotionValue(0), { stiffness: 170, damping: 15 });
  const y = useSpring(useMotionValue(0), { stiffness: 170, damping: 15 });
  return (
    <LazyMotion features={domAnimation} strict>
      <div
        onPointerMove={(event) => {
          if (reduce) return;
          const rect = event.currentTarget.getBoundingClientRect();
          x.set(event.clientX - rect.left - rect.width / 2);
          y.set(event.clientY - rect.top - rect.height / 2);
        }}
        onPointerLeave={() => { x.set(0); y.set(0); }}
        className="relative grid min-h-80 cursor-crosshair place-items-center overflow-hidden bg-cobalt text-paper"
      >
        <div className="absolute inset-4 border border-paper/40" />
        <p className="relative z-10 max-w-xs text-center font-display text-4xl">Move through the signal field.</p>
        <m.div aria-hidden="true" style={{ x, y }} className="absolute left-1/2 top-1/2 size-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-[18px] border-signal mix-blend-screen" />
      </div>
    </LazyMotion>
  );
}
