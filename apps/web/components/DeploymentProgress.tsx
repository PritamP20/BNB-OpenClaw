"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import AnimatedProgressStep from "./AnimatedProgressStep";
import { variants } from "../lib/animations";

export type DeploymentStage =
  | "idle"
  | "minting-nfa"
  | "deploying-token"
  | "deploying-curve"
  | "approving-curve"
  | "initializing-curve"
  | "calling-api"
  | "done"
  | "error";

interface DeploymentProgressProps {
  stage: DeploymentStage;
  error?: string;
  transactionHash?: string;
}

const stageOrder: Record<DeploymentStage, number> = {
  idle: 0,
  "minting-nfa": 1,
  "deploying-token": 2,
  "deploying-curve": 3,
  "approving-curve": 4,
  "initializing-curve": 5,
  "calling-api": 6,
  done: 7,
  error: -1,
};

const stepsConfig = [
  { id: "minting-nfa", title: "Mint Agent NFT", description: "Creating AI agent token" },
  { id: "deploying-token", title: "Deploy Token", description: "Deploying ERC-20 token contract" },
  { id: "deploying-curve", title: "Deploy Curve", description: "Setting up bonding curve" },
  { id: "approving-curve", title: "Approve Curve", description: "Approving curve initialization" },
  { id: "initializing-curve", title: "Initialize Curve", description: "Initializing token pricing" },
  { id: "calling-api", title: "Register Agent", description: "Registering on API" },
];

const getStepStatus = (
  stepId: string,
  currentStage: DeploymentStage,
  hasError: boolean,
): "pending" | "active" | "completed" | "error" => {
  if (hasError && stageOrder[currentStage] >= stageOrder[stepId]) {
    return "error";
  }

  if (stageOrder[currentStage] > stageOrder[stepId]) {
    return "completed";
  }

  if (stageOrder[currentStage] === stageOrder[stepId]) {
    return "active";
  }

  return "pending";
};

export const DeploymentProgress: React.FC<DeploymentProgressProps> = ({
  stage,
  error,
  transactionHash,
}) => {
  const isComplete = stage === "done";
  const hasError = stage === "error" && !!error;

  return (
    <motion.div
      variants={variants.slideUp}
      initial="hidden"
      animate="visible"
      className="w-full bg-bh-card border border-bh-border rounded-lg p-6"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mb-6"
      >
        <h3 className="text-lg font-bold text-bh-white mb-2">
          {isComplete ? "🎉 Deployment Complete!" : "Deployment Progress"}
        </h3>
        <p className="text-sm text-bh-strong">
          {isComplete
            ? "Your token has been successfully deployed to the blockchain."
            : hasError
              ? "An error occurred during deployment. Please try again."
              : "Follow along as your token is deployed..."}
        </p>
      </motion.div>

      {/* Steps */}
      <motion.div
        variants={variants.stepContainer}
        initial="hidden"
        animate="visible"
        className="space-y-4 mb-6"
      >
        {stepsConfig.map((step, index) => (
          <AnimatedProgressStep
            key={step.id}
            step={index + 1}
            totalSteps={stepsConfig.length}
            status={getStepStatus(step.id, stage, hasError)}
            title={step.title}
            description={step.description}
          />
        ))}
      </motion.div>

      {/* Status Messages */}
      <AnimatePresence mode="wait">
        {isComplete && (
          <motion.div
            key="success"
            variants={variants.slideUp}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg"
          >
            <p className="text-sm text-green-400 font-medium mb-2">
              ✓ Deployment Successful
            </p>
            {transactionHash && (
              <p className="text-xs text-bh-strong font-mono break-all">
                TX: {transactionHash}
              </p>
            )}
          </motion.div>
        )}

        {hasError && (
          <motion.div
            key="error"
            variants={variants.slideUp}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="mt-6 p-4 bg-bh-red/10 border border-bh-red/30 rounded-lg"
          >
            <p className="text-sm text-bh-red font-medium mb-2">✗ Deployment Failed</p>
            <p className="text-xs text-bh-strong">{error}</p>
          </motion.div>
        )}

        {!isComplete && !hasError && (
          <motion.div
            key="loading"
            variants={variants.fadeIn}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="mt-6 p-4 bg-bh-yellow/10 border border-bh-yellow/30 rounded-lg"
          >
            <p className="text-sm text-bh-yellow font-medium">
              ⏳ Deployment in progress...
            </p>
            <p className="text-xs text-bh-strong mt-1">
              This may take a few moments. Please don't close this page.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Action Buttons */}
      {isComplete && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-6 grid grid-cols-2 gap-3"
        >
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-4 py-2 bg-bh-yellow text-bh-bg font-semibold rounded text-sm transition-colors hover:bg-bh-yellow/90"
          >
            View Token
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-4 py-2 bg-bh-border text-bh-white font-semibold rounded text-sm transition-colors hover:bg-bh-muted"
          >
            Share
          </motion.button>
        </motion.div>
      )}
    </motion.div>
  );
};

export default DeploymentProgress;
