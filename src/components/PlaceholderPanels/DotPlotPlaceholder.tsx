import type { Mode } from "../../lib/types";

type DotPlotPlaceholderProps = {
  mode: Mode;
  disease: string;
  leftDisease: string;
  rightDisease: string;
  markerPanel: string;
  markerPanels: string[];
  onMarkerPanelChange: (panel: string) => void;
  genes: string[];
  loadingGenes: boolean;
};

export default function DotPlotPlaceholder({
  mode,
  disease,
  leftDisease,
  rightDisease,
  markerPanel,
  markerPanels,
  onMarkerPanelChange,
  genes,
  loadingGenes,
}: DotPlotPlaceholderProps) {
  const previewGenes = genes.slice(0, 20);
  const diseaseLabel = mode === "single" ? disease : `${leftDisease} and ${rightDisease}`;

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <div className="h3">Dot plot</div>
          <div className="muted small">Axes: genes × cell types</div>
          <div className="muted small">Dot size: % cells expressing</div>
          <div className="muted small">Color: mean expression or logFC ({diseaseLabel})</div>
        </div>
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
