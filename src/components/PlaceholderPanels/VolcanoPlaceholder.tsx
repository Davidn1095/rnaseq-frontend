import type { Mode } from "../../lib/types";

type VolcanoPlaceholderProps = {
  mode: Mode;
  disease: string;
  leftDisease: string;
  rightDisease: string;
  contrast: "left" | "right";
  cellType: string;
};

export default function VolcanoPlaceholder({
  mode,
  disease,
  leftDisease,
  rightDisease,
  contrast,
  cellType,
}: VolcanoPlaceholderProps) {
  const contrastLabel = mode === "single"
    ? `${disease} vs Healthy`
    : contrast === "left"
      ? `${leftDisease} vs Healthy`
      : `${rightDisease} vs Healthy`;

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <div className="h3">DE volcano (gene-level, per cell type)</div>
          <div className="muted small">
            Computed from donor-level pseudobulk within the selected cell type.
          </div>
          <div className="muted small">Contrast: {contrastLabel}</div>
          <div className="muted small">Cell type: {cellType}</div>
        </div>
        <div className="muted small">Compute disabled until analysis is wired.</div>
      </div>

      <svg className="placeholder-svg" viewBox="0 0 420 200" aria-hidden="true">
        <rect x="30" y="30" width="360" height="130" rx="12" fill="#f8fafc" stroke="#e2e8f0" />
        <line x1="210" y1="30" x2="210" y2="160" stroke="#cbd5f5" strokeWidth="2" />
        <text x="40" y="185" fill="#64748b" fontSize="12">logFC →</text>
        <text x="15" y="110" fill="#64748b" fontSize="12" transform="rotate(-90 15 110)">-log10 padj</text>
      </svg>
    </div>
  );
}
