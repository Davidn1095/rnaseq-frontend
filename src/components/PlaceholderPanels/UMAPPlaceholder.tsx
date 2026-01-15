import type { Mode } from "../../lib/types";

type UMAPPlaceholderProps = {
  mode: Mode;
  cellType: string;
  selectedAccessionCount: number;
  disease: string;
  leftDisease: string;
  rightDisease: string;
};

export default function UMAPPlaceholder({
  mode,
  cellType,
  selectedAccessionCount,
  disease,
  leftDisease,
  rightDisease,
}: UMAPPlaceholderProps) {
  const cohortLabel = mode === "single" ? disease : `${leftDisease} + ${rightDisease}`;

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <div className="h3">UMAP</div>
          <div className="muted small">Cohort: {cohortLabel} · Cell type: {cellType}</div>
          <div className="muted small">Selected accessions: {selectedAccessionCount}</div>
        </div>
        <div className="legend">
          <span className="legend-item"><span className="dot" />Disease</span>
          <span className="legend-item"><span className="dot" />Accession</span>
          <span className="legend-item"><span className="dot" />Cell type</span>
        </div>
      </div>

      <svg className="placeholder-svg" viewBox="0 0 420 240" aria-hidden="true">
        <rect x="30" y="20" width="360" height="180" rx="12" fill="#f8fafc" stroke="#e2e8f0" />
        <line x1="60" y1="180" x2="340" y2="180" stroke="#94a3b8" strokeWidth="2" />
        <line x1="60" y1="60" x2="60" y2="180" stroke="#94a3b8" strokeWidth="2" />
        <text x="180" y="215" fill="#64748b" fontSize="12">UMAP 1</text>
        <text x="15" y="120" fill="#64748b" fontSize="12" transform="rotate(-90 15 120)">UMAP 2</text>
        <circle cx="320" cy="70" r="6" fill="#cbd5f5" />
        <circle cx="350" cy="90" r="6" fill="#93c5fd" />
        <circle cx="300" cy="110" r="6" fill="#60a5fa" />
      </svg>
    </div>
  );
}
