import type { Mode } from "../../lib/types";

type ConcordancePlaceholderProps = {
  mode: Mode;
  leftDisease: string;
  rightDisease: string;
};

export default function ConcordancePlaceholder({
  mode,
  leftDisease,
  rightDisease,
}: ConcordancePlaceholderProps) {
  if (mode !== "compare") {
    return null;
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <div className="h3">Concordance</div>
          <div className="muted small">Scatter of logFC agreement across cell types.</div>
        </div>
        <div className="muted small">Placeholder for concordance diagnostics.</div>
      </div>

      <svg className="placeholder-svg" viewBox="0 0 420 200" aria-hidden="true">
        <rect x="30" y="30" width="360" height="130" rx="12" fill="#f8fafc" stroke="#e2e8f0" />
        <line x1="60" y1="150" x2="330" y2="50" stroke="#cbd5f5" strokeWidth="2" />
        <circle cx="120" cy="110" r="6" fill="#93c5fd" />
        <circle cx="190" cy="90" r="6" fill="#60a5fa" />
        <circle cx="250" cy="70" r="6" fill="#3b82f6" />
        <circle cx="300" cy="60" r="6" fill="#2563eb" />
        <text x="40" y="185" fill="#64748b" fontSize="12">
          logFC({leftDisease}) →
        </text>
        <text x="15" y="110" fill="#64748b" fontSize="12" transform="rotate(-90 15 110)">
          logFC({rightDisease})
        </text>
      </svg>
    </div>
  );
}
