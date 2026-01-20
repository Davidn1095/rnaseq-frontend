import { useEffect, useMemo, useRef, useState } from "react";
import type { DotplotResponse, Mode } from "../../lib/types";
import { DEFAULT_RESOLVED_BASE, fetchDotplot } from "../../lib/api";
import { getStoredApiBase } from "../../lib/storage";

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
  const apiBase = getStoredApiBase() ?? DEFAULT_RESOLVED_BASE;
  const [dotplot, setDotplot] = useState<DotplotResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const plotRef = useRef<HTMLDivElement | null>(null);
  const previewGenes = genes.slice(0, 20);
  const diseaseLabel = mode === "single" ? disease : `${leftDisease} and ${rightDisease}`;

  useEffect(() => {
    if (previewGenes.length === 0) return;
    let active = true;
    setError(null);
    fetchDotplot(apiBase, previewGenes)
      .then((res) => {
        if (!active) return;
        if (!res.ok) {
          setError(res.error ?? "Unable to load dotplot");
          setDotplot(null);
          return;
        }
        setDotplot(res);
      })
      .catch((err) => {
        if (!active) return;
        setError(String((err as Error).message ?? err));
        setDotplot(null);
      });
    return () => {
      active = false;
    };
  }, [apiBase, previewGenes]);

  const traces = useMemo(() => {
    if (!dotplot?.groups || !dotplot.genes || !dotplot.avg || !dotplot.pct) return [];
    const points = [] as Array<{ x: string; y: string; avg: number; pct: number }>;
    dotplot.genes.forEach((gene, gi) => {
      dotplot.groups!.forEach((group, gi2) => {
        points.push({
          x: gene,
          y: group,
          avg: dotplot.avg![gi][gi2],
          pct: dotplot.pct![gi][gi2],
        });
      });
    });
    return [
      {
        type: "scatter",
        mode: "markers",
        x: points.map((p) => p.x),
        y: points.map((p) => p.y),
        marker: {
          size: points.map((p) => 6 + p.pct * 30),
          color: points.map((p) => p.avg),
          colorscale: "Blues",
          showscale: true,
          colorbar: { title: "Avg" },
        },
      },
    ];
  }, [dotplot]);

  useEffect(() => {
    if (!plotRef.current || !window.Plotly || traces.length === 0) return;
    const layout = {
      margin: { l: 120, r: 30, t: 10, b: 70 },
      xaxis: { automargin: true },
      yaxis: { automargin: true },
      height: 420,
    };
    window.Plotly.react(plotRef.current, traces, layout, { displayModeBar: false, responsive: true });
  }, [traces]);

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

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="plot-frame" ref={plotRef} />
    </div>
  );
}
