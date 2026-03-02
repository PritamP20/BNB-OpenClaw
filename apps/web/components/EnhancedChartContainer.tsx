"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { variants } from "../lib/animations";

interface ChartDataPoint {
  time: number;
  value: number;
  [key: string]: any;
}

interface EnhancedChartContainerProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  showControls?: boolean;
  onZoomChange?: (zoomLevel: number) => void;
  animateOnDataChange?: boolean;
}

export const EnhancedChartContainer: React.FC<EnhancedChartContainerProps> = ({
  children,
  title,
  description,
  showControls = true,
  onZoomChange,
  animateOnDataChange = true,
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panX, setPanX] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);

  const handleZoomIn = () => {
    const newZoom = Math.min(zoomLevel + 0.2, 3);
    setZoomLevel(newZoom);
    onZoomChange?.(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoomLevel - 0.2, 1);
    setZoomLevel(newZoom);
    onZoomChange?.(newZoom);
  };

  const handleReset = () => {
    setZoomLevel(1);
    setPanX(0);
    onZoomChange?.(1);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsPanning(true);
      startXRef.current = e.clientX - panX;
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning && containerRef.current) {
      const newPanX = e.clientX - startXRef.current;
      const maxPan = (containerRef.current.offsetWidth * (zoomLevel - 1)) / 2;
      setPanX(Math.max(-maxPan, Math.min(newPanX, maxPan)));
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  return (
    <motion.div
      variants={variants.slideUp}
      initial="hidden"
      animate="visible"
      className="w-full"
    >
      {/* Header */}
      {(title || description) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          {title && (
            <h3 className="text-lg font-bold text-bh-white mb-1">{title}</h3>
          )}
          {description && (
            <p className="text-sm text-bh-strong">{description}</p>
          )}
        </motion.div>
      )}

      {/* Chart Container with Zoom/Pan */}
      <motion.div
        ref={containerRef}
        className="relative bg-bh-card border border-bh-border rounded-lg overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          cursor: isPanning ? "grabbing" : zoomLevel > 1 ? "grab" : "default",
        }}
      >
        {/* Chart Content with Zoom/Pan Transform */}
        <motion.div
          animate={{
            scale: zoomLevel,
            x: panX,
          }}
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 20,
          }}
          style={{
            originX: 0.5,
            originY: 0,
          }}
        >
          <motion.div
            initial={animateOnDataChange ? { opacity: 0 } : {}}
            animate={animateOnDataChange ? { opacity: 1 } : {}}
            transition={{ duration: 0.5 }}
          >
            {children}
          </motion.div>
        </motion.div>

        {/* Zoom Controls */}
        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute top-4 right-4 flex items-center gap-2 bg-bh-bg/80 backdrop-blur-sm border border-bh-border rounded-lg p-2"
            >
              <motion.button
                onClick={handleZoomOut}
                disabled={zoomLevel <= 1}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 hover:bg-bh-border rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-bh-white"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </motion.button>

              <div className="w-12 text-center text-xs text-bh-strong">
                {Math.round(zoomLevel * 100)}%
              </div>

              <motion.button
                onClick={handleZoomIn}
                disabled={zoomLevel >= 3}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 hover:bg-bh-border rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-bh-white"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </motion.button>

              <div className="w-px h-5 bg-bh-border mx-1" />

              <motion.button
                onClick={handleReset}
                disabled={zoomLevel === 1 && panX === 0}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 hover:bg-bh-border rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-bh-white"
                title="Reset View"
              >
                <RotateCcw className="w-4 h-4" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pan Hint */}
        <AnimatePresence>
          {zoomLevel > 1 && !isPanning && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 1 }}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-bh-strong bg-bh-bg/60 backdrop-blur-sm px-3 py-1.5 rounded"
            >
              Drag to pan
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Legend or Additional Info */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-4 text-xs text-bh-strong"
      >
        <p>💡 Hover over data points for details. Use zoom controls for close-up views.</p>
      </motion.div>
    </motion.div>
  );
};

export default EnhancedChartContainer;
