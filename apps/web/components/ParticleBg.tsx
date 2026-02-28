"use client";

/**
 * Bauhaus geometric background layer.
 * Replaces old particle/orb system with clean geometric shapes.
 */
export function ParticleBg() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      {/* Large circle — top-right */}
      <div
        className="absolute -top-32 -right-32 h-80 w-80 rounded-full"
        style={{ border: "1px solid rgba(245,194,32,0.08)" }}
      />
      {/* Medium circle — center-left */}
      <div
        className="absolute top-1/2 -left-24 h-48 w-48 rounded-full"
        style={{ border: "1px solid rgba(245,194,32,0.05)" }}
      />
      {/* Yellow filled square accent — top-left */}
      <div
        className="absolute top-12 left-8 h-2 w-2"
        style={{ background: "#F5C220", opacity: 0.4 }}
      />
      {/* Blue filled square accent — top-right area */}
      <div
        className="absolute top-24 right-16 h-2 w-2"
        style={{ background: "#1B4EF8", opacity: 0.3 }}
      />
      {/* Red dot */}
      <div
        className="absolute bottom-16 left-1/3 h-1.5 w-1.5"
        style={{ background: "#D62828", opacity: 0.35 }}
      />
      {/* Horizontal rule accent */}
      <div
        className="absolute top-1/3 left-0 h-px w-24"
        style={{ background: "#F5C220", opacity: 0.12 }}
      />
    </div>
  );
}
