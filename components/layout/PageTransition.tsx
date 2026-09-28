"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduced = useReducedMotion();

  if (reduced) {
    return <div key={pathname}>{children}</div>;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        variants={{
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: -6 },
        }}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.2, ease: "easeInOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
