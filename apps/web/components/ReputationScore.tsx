import { Token } from "../hooks/useTokens";

const COMPONENTS = [
  { label: "Fundraising", max: 30, key: "fund" },
  { label: "Graduation", max: 20, key: "grad" },
  { label: "Distribution", max: 20, key: "dist" },
  { label: "Burn Ratio", max: 20, key: "burn" },
  { label: "Longevity", max: 10, key: "long" },
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

function ScoreRing({ score }: { score: number }) {
  const color =
    score >= 75 ? "text-green-400" : score >= 50 ? "text-bnb-yellow" : "text-red-400";
  const label =
    score >= 75 ? "Healthy" : score >= 50 ? "Growing" : "Early";
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`flex h-20 w-20 items-center justify-center rounded-full border-4 ${score >= 75
            ? "border-green-400/30"
            : score >= 50
              ? "border-bnb-yellow/30"
              : "border-red-400/30"
          }`}
      >
        <span className={`text-2xl font-extrabold ${color}`}>{score}</span>
      </div>
      <span className={`text-xs font-semibold ${color}`}>{label}</span>
    </div>
  );
}

export function ReputationScore({ token }: { token: Token }) {
  const scores = deriveScoreComponents(token);

  return (
    <div className="rounded-2xl border border-bnb-border bg-bnb-card p-5">
      <h3 className="mb-4 text-sm font-semibold text-white">Reputation Score</h3>
      <div className="flex items-start gap-6">
        <ScoreRing score={token.reputationScore} />
        <div className="flex-1 flex flex-col gap-2">
          {COMPONENTS.map(({ label, max, key }) => {
            const val = scores[key];
            const pct = (val / max) * 100;
            return (
              <div key={key}>
                <div className="mb-0.5 flex justify-between text-xs text-gray-500">
                  <span>{label}</span>
                  <span className="font-mono">
                    {val}/{max}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-bnb-yellow transition-all"
                    style={{ width: `${pct}%` }}
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
