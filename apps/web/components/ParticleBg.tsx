"use client";

/** Pure-CSS animated background layer:
 *  - Premium radial gradient hero glow
 *  - Floating golden orbs with depth layers
 *  - Streak light trails
 *  - Ambient vignette
 *  No canvas / WebGL — zero bundle cost.
 */
export function ParticleBg() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {/* Hero radial glow — warm amber center */}
      <div
        className="absolute -top-32 left-1/2 -translate-x-1/2 h-[700px] w-[1000px] rounded-full opacity-50"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(243,186,47,0.1) 0%, rgba(243,186,47,0.03) 35%, transparent 65%)",
          filter: "blur(80px)",
        }}
      />

      {/* Secondary cool-tone glow for depth */}
      <div
        className="absolute top-40 -right-32 h-[500px] w-[500px] rounded-full opacity-20"
        style={{
          background:
            "radial-gradient(circle, rgba(168,85,247,0.15) 0%, transparent 65%)",
          filter: "blur(100px)",
        }}
      />

      {/* Orb 1 — top-left warm */}
      <div
        className="absolute -top-24 -left-24 h-72 w-72 rounded-full animate-float opacity-20"
        style={{
          background:
            "radial-gradient(circle, rgba(243,186,47,0.4) 0%, transparent 65%)",
          filter: "blur(90px)",
        }}
      />
      {/* Orb 2 — top-right cool */}
      <div
        className="absolute top-16 -right-20 h-64 w-64 rounded-full animate-float-reverse opacity-15"
        style={{
          background:
            "radial-gradient(circle, rgba(52,211,153,0.2) 0%, transparent 65%)",
          filter: "blur(80px)",
          animationDelay: "2.5s",
        }}
      />
      {/* Orb 3 — bottom-centre diffused */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 h-80 w-[600px] rounded-full opacity-15"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(243,186,47,0.2) 0%, transparent 60%)",
          filter: "blur(100px)",
          animation: "float 12s ease-in-out infinite",
          animationDelay: "1s",
        }}
      />

      {/* Light streak 1 */}
      <div
        className="absolute top-36 left-0 h-px w-72 opacity-0 animate-streak"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(243,186,47,0.5), rgba(243,186,47,0.15), transparent)",
          animationDelay: "0s",
          animationDuration: "6s",
        }}
      />
      {/* Light streak 2 */}
      <div
        className="absolute top-64 left-0 h-px w-48 opacity-0 animate-streak"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(255,233,153,0.3), transparent)",
          animationDelay: "3s",
          animationDuration: "7s",
        }}
      />
      {/* Light streak 3 */}
      <div
        className="absolute top-[400px] left-0 h-px w-56 opacity-0 animate-streak"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(243,186,47,0.25), transparent)",
          animationDelay: "5s",
          animationDuration: "8s",
        }}
      />

      {/* Tiny floating particles — subtle */}
      {([
        { top: "15%", left: "10%", delay: "0s", size: 2 },
        { top: "30%", left: "85%", delay: "1.2s", size: 1.5 },
        { top: "50%", left: "22%", delay: "2.4s", size: 2.5 },
        { top: "68%", left: "68%", delay: "0.8s", size: 1.5 },
        { top: "22%", left: "52%", delay: "3.5s", size: 2 },
        { top: "78%", left: "38%", delay: "2s", size: 1.5 },
      ] as const).map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            top: p.top,
            left: p.left,
            width: p.size,
            height: p.size,
            background: "#F3BA2F",
            boxShadow: "0 0 4px rgba(243,186,47,0.6)",
            animation: `glow-pulse 3s ease-in-out infinite ${p.delay}, particle-drift 12s ease-in-out infinite ${p.delay}`,
          }}
        />
      ))}

      {/* Deep vignette for premium depth */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(6,6,8,0.6) 80%, rgba(6,6,8,0.9) 100%)",
        }}
      />
    </div>
  );
}
