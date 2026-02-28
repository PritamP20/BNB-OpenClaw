"use client";

/** Pure-CSS animated background layer:
 *  - BG radial gradient hero glow
 *  - Floating golden orbs
 *  - Streak light trails
 *  No canvas / WebGL — zero bundle cost.
 */
export function ParticleBg() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {/* Hero radial glow */}
      <div
        className="absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full opacity-60"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(243,186,47,0.13) 0%, rgba(243,186,47,0.04) 40%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      {/* Orb 1 — top-left */}
      <div
        className="absolute -top-20 -left-20 h-80 w-80 rounded-full animate-float opacity-30"
        style={{
          background:
            "radial-gradient(circle, rgba(243,186,47,0.55) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />
      {/* Orb 2 — top-right */}
      <div
        className="absolute top-10 -right-16 h-72 w-72 rounded-full animate-float-rev opacity-25"
        style={{
          background:
            "radial-gradient(circle, rgba(243,186,47,0.4) 0%, transparent 70%)",
          filter: "blur(70px)",
          animationDelay: "2s",
        }}
      />
      {/* Orb 3 — bottom-centre */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 h-96 w-[700px] rounded-full opacity-20"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(243,186,47,0.3) 0%, transparent 65%)",
          filter: "blur(90px)",
          animation: "float 10s ease-in-out infinite",
          animationDelay: "1s",
        }}
      />

      {/* Light streak 1 */}
      <div
        className="absolute top-32 left-0 h-px w-64 opacity-0 animate-streak"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(243,186,47,0.7), rgba(243,186,47,0.3), transparent)",
          animationDelay: "0s",
          animationDuration: "5s",
        }}
      />
      {/* Light streak 2 */}
      <div
        className="absolute top-60 left-0 h-px w-40 opacity-0 animate-streak"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(255,220,100,0.5), transparent)",
          animationDelay: "2.5s",
          animationDuration: "6s",
        }}
      />
      {/* Light streak 3 */}
      <div
        className="absolute top-96 left-0 h-px w-52 opacity-0 animate-streak"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(243,186,47,0.4), transparent)",
          animationDelay: "4s",
          animationDuration: "7s",
        }}
      />

      {/* Tiny floating particles */}
      {([
        { top: "18%", left: "12%", delay: "0s", size: 3 },
        { top: "35%", left: "82%", delay: "1s", size: 2 },
        { top: "55%", left: "25%", delay: "2s", size: 4 },
        { top: "70%", left: "65%", delay: "0.5s", size: 2 },
        { top: "25%", left: "50%", delay: "3s", size: 3 },
        { top: "80%", left: "40%", delay: "1.5s", size: 2 },
      ] as const).map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full animate-glow-pulse"
          style={{
            top: p.top,
            left: p.left,
            width: p.size,
            height: p.size,
            background: "#F3BA2F",
            boxShadow: "0 0 6px rgba(243,186,47,0.8)",
            animationDelay: p.delay,
            animation: `glow-pulse 2.2s ease-in-out infinite ${p.delay}, particle-drift 8s ease-in-out infinite ${p.delay}`,
          }}
        />
      ))}

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 50%, rgba(8,8,12,0.7) 100%)",
        }}
      />
    </div>
  );
}
