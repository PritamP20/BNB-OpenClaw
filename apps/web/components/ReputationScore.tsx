import { Token } from "../hooks/useTokens";

const COMPONENTS = [
  { label: "Fundraising", max: 30, key: "fund" },
  { label: "Graduation",  max: 20, key: "grad" },
  { label: "Distribution",max: 20, key: "dist" },
  { label: "Burn Ratio",  max: 20, key: "burn" },
  { label: "Longevity",   max: 10, key: "long" },
] as const;

function deriveScoreComponents(token: Token) {
  const s = token.reputationScore;
  const fund = Math.min(30, Math.round((token.graduationProgress / 100) * 30));
  const grad = token.isGraduated ? 20 : 0;
  const dist = Math.min(20, Math.round((token.holders / 2000) * 20));
  const burn = Math.min(20, Math.round(s / 5));
  const long = Date.now() - token.createdAt > 7 * 86400000 ? 10 : 0;
  return { fund, grad, dist, burn, long };
}

function ScoreBlock({ score }: { score: number }) {
  const color = score >= 75 ? "#4ade80" : score >= 50 ? "#F5C220" : "#D62828";
  const label = score >= 75 ? "Healthy" : score >= 50 ? "Growing" : "Early";
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="flex h-20 w-20 items-center justify-center"
        style={{ background: "#222222", border: `2px solid ${color}` }}
      >
        <span className="text-2xl font-black" style={{ color }}>{score}</span>
      </div>
      <span className="text-xs font-black uppercase tracking-wider" style={{ color }}>{label}</span>
    </div>
  );
}

const BAR_COLORS: Record<string, string> = {
  fund: "#1B4EF8",
  grad: "#4ade80",
  dist: "#F5C220",
  burn: "#D62828",
  long: "#F5C220",
};

export function ReputationScore({ token }: { token: Token }) {
  const scores = deriveScoreComponents(token);

  return (
    <div style={{ background: "#1A1A1A", border: "1px solid #333333", borderTop: "3px solid #F5C220", padding: "20px" }}>
      <h3 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-wider" style={{ color: "#F5F5F5" }}>
        <span className="flex h-6 w-6 items-center justify-center" style={{ background: "#F5C220", color: "#0F0F0F" }}>
          ⭐
        </span>
        Reputation Score
      </h3>
      <div className="flex items-start gap-6">
        <ScoreBlock score={token.reputationScore} />
        <div className="flex-1 flex flex-col gap-3">
          {COMPONENTS.map(({ label, max, key }) => {
            const val = scores[key];
            const pct = (val / max) * 100;
            return (
              <div key={key}>
                <div className="mb-1 flex justify-between text-[10px]">
                  <span className="font-black uppercase tracking-wider" style={{ color: "#555555" }}>{label}</span>
                  <span className="font-mono font-bold" style={{ color: "#888888" }}>{val}/{max}</span>
                </div>
                <div className="h-1.5 w-full bh-progress-track">
                  <div
                    className="h-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: BAR_COLORS[key] }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
