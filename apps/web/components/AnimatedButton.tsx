"use client";

import React from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

interface AnimatedButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  type?: "button" | "submit" | "reset";
  className?: string;
  icon?: React.ReactNode;
}

const variantStyles = {
  primary:
    "bg-bh-yellow text-bh-bg hover:bg-bh-yellow/90 font-semibold",
  secondary:
    "bg-bh-border text-bh-white hover:bg-bh-muted font-semibold",
  danger:
    "bg-bh-red text-bh-white hover:bg-bh-red/90 font-semibold",
};

const sizeStyles = {
  sm: "px-3 py-2 text-sm rounded",
  md: "px-4 py-2.5 text-base rounded",
  lg: "px-6 py-3 text-base rounded-lg",
};

export const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  children,
  onClick,
  disabled = false,
  loading = false,
  variant = "primary",
  size = "md",
  type = "button",
  className = "",
  icon,
}) => {
  const isDisabled = disabled || loading;

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      whileHover={!isDisabled ? { scale: 1.02 } : {}}
      whileTap={!isDisabled ? { scale: 0.98 } : {}}
      className={`
        relative inline-flex items-center justify-center gap-2
        transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
    >
      {/* Loading Spinner */}
      {loading && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 className="w-4 h-4" />
        </motion.div>
      )}

      {/* Icon */}
      {icon && !loading && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
        >
          {icon}
        </motion.div>
      )}

      {/* Text */}
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        {children}
      </motion.span>

      {/* Ripple Effect Background */}
      {!isDisabled && (
        <RippleEffect />
      )}
    </motion.button>
  );
};

// Ripple Effect Component
const RippleEffect: React.FC = () => {
  const [ripples, setRipples] = React.useState<
    Array<{ id: number; x: number; y: number }>
  >([]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Math.random();

    setRipples((prev) => [...prev, { id, x, y }]);

    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 600);
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      className="absolute inset-0 overflow-hidden rounded pointer-events-none"
    >
      {ripples.map((ripple) => (
        <motion.div
          key={ripple.id}
          className="absolute pointer-events-none bg-white/30 rounded-full"
          initial={{ x: ripple.x, y: ripple.y, scale: 0 }}
          animate={{ scale: 4 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{
            width: 10,
            height: 10,
            marginLeft: -5,
            marginTop: -5,
          }}
        />
      ))}
    </div>
  );
};

export default AnimatedButton;
