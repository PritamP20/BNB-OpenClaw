"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { X, Check, AlertCircle } from "lucide-react";
import { variants } from "../lib/animations";

interface AnimatedInputProps {
  label?: string;
  placeholder?: string;
  type?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  success?: boolean;
  disabled?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

export const AnimatedInput: React.FC<AnimatedInputProps> = ({
  label,
  placeholder,
  type = "text",
  value,
  onChange,
  error,
  success,
  disabled = false,
  className = "",
  icon,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const hasError = !!error;
  const hasContent = !!value;

  return (
    <motion.div
      variants={variants.slideUp}
      initial="hidden"
      animate="visible"
      className={`relative ${className}`}
    >
      {/* Label */}
      {label && (
        <motion.label
          animate={
            isFocused || hasContent
              ? { y: -24, scale: 0.85 }
              : { y: 0, scale: 1 }
          }
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className={`absolute left-3 block text-sm font-medium pointer-events-none transition-colors ${
            isFocused
              ? "text-bh-yellow"
              : hasError
                ? "text-bh-red"
                : success
                  ? "text-green-400"
                  : "text-bh-strong"
          }`}
        >
          {label}
        </motion.label>
      )}

      {/* Input Container */}
      <motion.div
        className="relative"
        animate={
          isFocused
            ? { boxShadow: "0 0 0 2px rgba(245, 194, 32, 0.2)" }
            : {}
        }
        transition={{ duration: 0.2 }}
      >
        {/* Icon */}
        {icon && (
          <motion.div
            className="absolute left-3 top-1/2 -translate-y-1/2 text-bh-strong"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            {icon}
          </motion.div>
        )}

        {/* Input Field */}
        <input
          type={type}
          placeholder={isFocused ? placeholder : ""}
          value={value}
          onChange={onChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={disabled}
          className={`
            w-full px-3 py-2.5 bg-bh-card border rounded text-bh-white placeholder-bh-strong
            transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
            ${
              icon ? "pl-10" : ""
            }
            ${
              hasError
                ? "border-bh-red focus:border-bh-red focus:outline-none"
                : success
                  ? "border-green-500 focus:border-green-500 focus:outline-none"
                  : isFocused
                    ? "border-bh-yellow focus:border-bh-yellow focus:outline-none"
                    : "border-bh-border focus:border-bh-yellow focus:outline-none"
            }
          `}
        />

        {/* Status Icons */}
        <motion.div
          className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1"
          initial={{ opacity: 0, x: 10 }}
          animate={{
            opacity:
              hasError || success || (isFocused && hasContent) ? 1 : 0,
            x: hasError || success || (isFocused && hasContent) ? 0 : 10,
          }}
          transition={{ duration: 0.2 }}
        >
          {hasError && (
            <motion.div
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
            >
              <AlertCircle className="w-4 h-4 text-bh-red" />
            </motion.div>
          )}
          {success && !hasError && (
            <motion.div
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
            >
              <Check className="w-4 h-4 text-green-400" />
            </motion.div>
          )}
          {hasContent && !hasError && !success && isFocused && (
            <motion.button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onChange?.({ target: { value: "" } } as any);
              }}
              className="text-bh-strong hover:text-bh-white transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <X className="w-4 h-4" />
            </motion.button>
          )}
        </motion.div>
      </motion.div>

      {/* Error Message */}
      {error && (
        <motion.p
          variants={variants.slideUp}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="mt-2 text-xs text-bh-red flex items-center gap-1"
        >
          <AlertCircle className="w-3 h-3" />
          {error}
        </motion.p>
      )}
    </motion.div>
  );
};

export default AnimatedInput;
