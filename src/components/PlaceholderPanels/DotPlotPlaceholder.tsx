import { useMemo } from "react";
import type { Mode } from "../../lib/types";

type DotPlotPlaceholderProps = {
  mode: Mode;
  disease: string;
  leftDisease: string;
  rightDisease: string;
  contrast: "left" | "right";
  markerPanel: string;
  markerPanels: string[];
  onMarkerPanelChange: (panel: string) => void;
  onContrastChange: (next: "left" | "right") => void;
  genes: string[];
  loadingGenes: boolean;
};

export default function DotPlotPlaceholder({
  mode,
  disease,
  leftDisease,
  rightDisease,
  contrast,
  markerPanel,
  markerPanels,
  onMarkerPanelChange,
  onContrastChange,
  genes,
  loadingGenes,
}: DotPlotPlaceholderProps) {
  const contrastLabel = useMemo(() => {
    if (mode === "single") return `${disease} vs Healthy`;
    return contrast === "left" ? `${leftDisease} vs Healthy` : `${rightDisease} vs Healthy`;
  }, [mode, disease, leftDisease, rightDisease, contrast]);

  const previewGenes = genes.slice(0, 20);

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <div className="h3">Dot plot</div>
          <div className="muted small">Axes: genes × cell types</div>
          <div className="muted small">Dot size: % cells expressing</div>
          <div className="muted small">Color: mean expression or logFC for {contrastLabel}</div>
        </div>
        {mode === "compare" ? (
          <div className="field">
            <label className="muted small">Contrast</label>
            <select
              className="select"
              value={contrast}
              onChange={(event) => onContrastChange(event.target.value as "left" | "right")}
            >
              <option value="left">{leftDisease} vs Healthy</option>
              <option value="right">{rightDisease} vs Healthy</option>
            </select>
          </div>
        ) : null}
      </div>

      <div className="row gap top">
        <div className="field">
          <label className="muted small">Marker panel</label>
          <select
            className="select"
            value={markerPanel}
            onChange={(event) => onMarkerPanelChange(event.target.value)}
          >
            {markerPanels.map((panel) => (
              <option key={panel} value={panel}>{panel}</option>
            ))}
          </select>
        </div>
        <div className="field grow">
          <label className="muted small">Genes (preview)</label>
          <div className="scroll-box">
            {loadingGenes ? (
              <div className="skeleton-lines" />
            ) : (
              <ul>
                {previewGenes.map((gene) => (
                  <li key={gene}>{gene}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <svg className="placeholder-svg" viewBox="0 0 420 200" aria-hidden="true">
        <rect x="30" y="30" width="360" height="130" rx="12" fill="#f8fafc" stroke="#e2e8f0" />
        <text x="40" y="185" fill="#64748b" fontSize="12">Genes →</text>
        <text x="15" y="110" fill="#64748b" fontSize="12" transform="rotate(-90 15 110)">Cell types</text>
      </svg>
    </div>
  );
}
