// Animation presets and utilities for Framer Motion
import type { Variants } from "framer-motion";

export const animationPresets = {
  // Spring presets for different feels
  spring: {
    smooth: {
      type: "spring" as const,
      stiffness: 80,
      damping: 20,
      mass: 1,
    },
    bounce: {
      type: "spring" as const,
      stiffness: 150,
      damping: 15,
      mass: 1,
    },
    stiff: {
      type: "spring" as const,
      stiffness: 300,
      damping: 30,
      mass: 1,
    },
  },

  // Easing functions
  easing: {
    easeIn: [0.4, 0, 1, 1],
    easeOut: [0, 0, 0.2, 1],
    easeInOut: [0.4, 0, 0.2, 1],
    linear: [0, 0, 1, 1],
  },
};

// Variant patterns for common animations
export const variants: Record<string, Variants> = {
  // Fade and Slide animations
  container: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  },

  item: {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring" as const, stiffness: 100, damping: 15 },
    },
  },

  slideUp: {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring" as const, stiffness: 100, damping: 20 },
    },
    exit: {
      opacity: 0,
      y: -40,
      transition: { duration: 0.2 },
    },
  },

  slideDown: {
    hidden: { opacity: 0, y: -40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring" as const, stiffness: 100, damping: 20 },
    },
    exit: {
      opacity: 0,
      y: 40,
      transition: { duration: 0.2 },
    },
  },

  slideLeft: {
    hidden: { opacity: 0, x: 40 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { type: "spring" as const, stiffness: 100, damping: 20 },
    },
    exit: {
      opacity: 0,
      x: -40,
      transition: { duration: 0.2 },
    },
  },

  slideRight: {
    hidden: { opacity: 0, x: -40 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { type: "spring" as const, stiffness: 100, damping: 20 },
    },
    exit: {
      opacity: 0,
      x: 40,
      transition: { duration: 0.2 },
    },
  },

  fadeIn: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.4 },
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.2 },
    },
  },

  scaleIn: {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { type: "spring" as const, stiffness: 200, damping: 20 },
    },
    exit: {
      opacity: 0,
      scale: 0.9,
      transition: { duration: 0.2 },
    },
  },

  // Button animations
  buttonHover: {
    scale: 1.02,
    transition: { type: "spring" as const, stiffness: 400, damping: 10 },
  },

  buttonTap: {
    scale: 0.98,
  },

  // Loading spinner
  spinner: {
    animate: {
      rotate: 360,
      transition: {
        duration: 1,
        repeat: Infinity,
        ease: "linear",
      },
    },
  },

  // Progress step animations
  stepContainer: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
      },
    },
  },

  stepItem: {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { type: "spring" as const, stiffness: 150, damping: 15 },
    },
  },

  stepCheckmark: {
    hidden: { scale: 0, rotate: -90 },
    visible: {
      scale: 1,
      rotate: 0,
      transition: { type: "spring" as const, stiffness: 200, damping: 15 },
    },
  },

  // Chart animations
  chartBar: {
    initial: { height: 0 },
    animate: (i: number) => ({
      height: "100%",
      transition: {
        delay: i * 0.05,
        duration: 0.6,
        ease: "easeOut",
      },
    }),
  },

  chartLine: {
    initial: { pathLength: 0 },
    animate: {
      pathLength: 1,
      transition: { duration: 1.5, ease: "easeInOut" },
    },
  },

  // Shake animation for errors
  shake: {
    animate: {
      x: [-5, 5, -5, 5, 0],
      transition: {
        duration: 0.5,
        ease: "easeInOut",
      },
    },
  },

  // Pulse animation
  pulse: {
    animate: {
      opacity: [1, 0.6, 1],
      transition: {
        duration: 2,
        repeat: Infinity,
      },
    },
  },
};

// Tab animation variants
export const tabVariants: Variants = {
  initial: { opacity: 0, x: 20 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3 },
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: { duration: 0.2 },
  },
};

// Success checkmark animation
export const successCheckmark: Variants = {
  hidden: { scale: 0 },
  visible: {
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 200,
      damping: 15,
    },
  },
};

// Tooltip animation
export const tooltipVariants: Variants = {
  hidden: { opacity: 0, y: -10, pointerEvents: "none" },
  visible: {
    opacity: 1,
    y: 0,
    pointerEvents: "auto",
    transition: { duration: 0.2 },
  },
  exit: {
    opacity: 0,
    y: -10,
    pointerEvents: "none",
    transition: { duration: 0.15 },
  },
};

// Modal animation
export const modalVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.3 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

export const modalContentVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 200,
      damping: 20,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 20,
    transition: { duration: 0.2 },
  },
};
