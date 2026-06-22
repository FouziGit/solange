"use client";

import { MotionConfig, motion } from "motion/react";
import { usePathname } from "next/navigation";

/**
 * Global motion baseline + route transition.
 * MotionConfig reducedMotion="user" makes every Motion animation honor the
 * OS reduced-motion setting; the keyed motion.div replays a soft fade-up on
 * each route change (template re-mounts per navigation, unlike layout).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </MotionConfig>
  );
}
