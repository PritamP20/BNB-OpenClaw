"use client";

import React from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Circle, AlertCircle, Loader2 } from "lucide-react";
import { variants } from "../lib/animations";

type StepStatus = "pending" | "active" | "completed" | "error";

interface AnimatedProgressStepProps {
  step: number;
  totalSteps: number;
  status: StepStatus;
  title: string;
  description?: string;
  onClick?: () => void;
}

const statusConfig = {
  pending: {
    bg: "bg-bh-border",
    icon: Circle,
    textColor: "text-bh-strong",
  },
  active: {
    bg: "bg-bh-yellow",
    icon: Loader2,
    textColor: "text-bh-white",
  },
  completed: {
    bg: "bg-green-500",
    icon: CheckCircle2,
    textColor: "text-bh-white",
  },
  error: {
    bg: "bg-bh-red",
    icon: AlertCircle,
    textColor: "text-bh-white",
  },
};

export const AnimatedProgressStep: React.FC<AnimatedProgressStepProps> = ({
  step,
  status,
  title,
  description,
  onClick,
}) => {
  const config = statusConfig[status];
  const IconComponent = config.icon;

  return (
    <motion.div
      variants={variants.stepItem}
      initial="hidden"
      animate="visible"
      className="flex items-start gap-4 cursor-pointer"
      onClick={onClick}
      whileHover={{ x: 4 }}
      transition={{ type: "spring", stiffness: 200, damping: 10 }}
    >
      {/* Step Circle with Icon */}
      <motion.div
        className={`relative flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${config.bg} transition-colors duration-300`}
        animate={status === "active" ? { scale: [1, 1.1, 1] } : { scale: 1 }}
        transition={
          status === "active"
            ? { duration: 1.5, repeat: Infinity }
            : { duration: 0.3 }
        }
      >
        {status === "active" ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <IconComponent className="w-5 h-5 text-bh-bg" />
          </motion.div>
        ) : (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
          >
            <IconComponent className="w-5 h-5 text-bh-bg" />
          </motion.div>
        )}
      </motion.div>

      {/* Text Content */}
      <motion.div
        className="flex-1 min-w-0"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
      >
        <motion.h4
          className={`font-semibold text-sm ${config.textColor} transition-colors duration-300`}
          animate={status === "active" ? { color: "#F5C220" } : {}}
        >
          Step {step}: {title}
        </motion.h4>
        {description && (
          <motion.p
            className="text-xs text-bh-strong mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.3 }}
          >
            {description}
          </motion.p>
        )}
      </motion.div>

      {/* Connecting Line for non-last steps */}
      {status === "completed" && (
        <motion.div
          className="absolute left-[19px] top-10 w-0.5 h-6 bg-green-500"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        />
      )}
    </motion.div>
  );
};

export default AnimatedProgressStep;
