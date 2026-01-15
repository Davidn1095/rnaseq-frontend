import type { Mode } from "../../lib/types";

type ExpressionPlaceholderProps = {
  mode: Mode;
  disease: string;
  leftDisease: string;
  rightDisease: string;
  genes: string[];
};

export default function ExpressionPlaceholder({
  mode,
  disease,
  leftDisease,
  rightDisease,
  genes,
}: ExpressionPlaceholderProps) {
  const groupLabel = mode === "single"
    ? `Healthy, ${disease}`
    : `Healthy, ${leftDisease}, ${rightDisease}`;

  const previewGenes = genes.slice(0, 6);

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <div className="h3">Expression</div>
          <div className="muted small">Per-cell distributions for selected gene(s).</div>
          <div className="muted small">Groups: {groupLabel}</div>
        </div>
        <div className="muted small">Violin/ridge plot placeholder.</div>
      </div>

      <div className="row gap top">
        <div className="field grow">
          <label className="muted small">Selected genes (preview)</label>
          <div className="scroll-box">
            {previewGenes.length > 0 ? (
              <ul>
                {previewGenes.map((gene) => (
                  <li key={gene}>{gene}</li>
                ))}
              </ul>
            ) : (
              <div className="muted small">No genes selected yet.</div>
            )}
          </div>
        </div>
      </div>

      <svg className="placeholder-svg" viewBox="0 0 420 200" aria-hidden="true">
        <rect x="30" y="30" width="360" height="130" rx="12" fill="#f8fafc" stroke="#e2e8f0" />
        <path d="M60 150 C90 120 120 90 150 70 C180 50 210 70 240 95 C270 120 300 130 330 140" stroke="#94a3b8" strokeWidth="3" fill="none" />
        <path d="M70 145 C100 120 130 95 160 80 C190 65 220 80 250 100 C280 120 305 130 340 138" stroke="#cbd5f5" strokeWidth="3" fill="none" />
        <text x="40" y="185" fill="#64748b" fontSize="12">Expression →</text>
        <text x="15" y="110" fill="#64748b" fontSize="12" transform="rotate(-90 15 110)">Cells</text>
      </svg>
    </div>
  );
}
