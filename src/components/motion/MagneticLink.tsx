import {
  LazyMotion,
  domAnimation,
  m,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import type { MouseEvent, PropsWithChildren } from "react";

export default function MagneticLink({
  href,
  children,
  className = "",
}: PropsWithChildren<{ href: string; className?: string }>) {
  const reduce = useReducedMotion();
  const x = useSpring(useMotionValue(0), { stiffness: 250, damping: 18 });
  const y = useSpring(useMotionValue(0), { stiffness: 250, damping: 18 });
  const move = (event: MouseEvent<HTMLAnchorElement>) => {
    if (reduce) return;
    const rect = event.currentTarget.getBoundingClientRect();
    x.set((event.clientX - rect.left - rect.width / 2) * 0.18);
    y.set((event.clientY - rect.top - rect.height / 2) * 0.18);
  };
  const reset = () => {
    x.set(0);
    y.set(0);
  };
  return (
    <LazyMotion features={domAnimation} strict>
      <m.a
        href={href}
        onMouseMove={move}
        onMouseLeave={reset}
        style={{ x, y }}
        className={className}
      >
        {children}
      </m.a>
    </LazyMotion>
  );
}
