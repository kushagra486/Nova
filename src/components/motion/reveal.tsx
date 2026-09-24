"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Delay in seconds, for staggered sequences (30-50ms per item per UX guidance). */
  delay?: number;
  /** "mount" fades in immediately (above the fold); "scroll" reveals once in view. */
  trigger?: "mount" | "scroll";
}

const variants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

/**
 * A single fade+slide-up reveal, spring-eased per Apple HIG's fluid motion
 * guidance. Collapses to an instant, non-animated appearance under
 * prefers-reduced-motion rather than skipping the content.
 */
export function Reveal({ children, className, delay = 0, trigger = "mount" }: RevealProps) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      animate={trigger === "mount" ? "visible" : undefined}
      whileInView={trigger === "scroll" ? "visible" : undefined}
      viewport={trigger === "scroll" ? { once: true, margin: "-80px" } : undefined}
      variants={variants}
      transition={{ type: "spring", stiffness: 120, damping: 18, delay }}
    >
      {children}
    </motion.div>
  );
}
