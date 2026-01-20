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
  onMarkerPanelChange: _onMarkerPanelChange,
  genes,
  loadingGenes,
}: DotPlotPlaceholderProps) {
  const apiBase = getStoredApiBase() ?? DEFAULT_RESOLVED_BASE;
  const [dotplot, setDotplot] = useState<DotplotResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const plotRef = useRef<HTMLDivElement | null>(null);
  const previewGenes = genes.slice(0, 30);
  const [selectedGenes, setSelectedGenes] = useState<string[]>(previewGenes);
  const diseaseLabel = mode === "single" ? disease : `${leftDisease} and ${rightDisease}`;

  useEffect(() => {
    if (genes.length === 0) {
      setSelectedGenes([]);
      return;
    }
    setSelectedGenes((prev) => {
      const next = prev.filter((gene) => genes.includes(gene));
      return next.length > 0 ? next : genes.slice(0, 30);
    });
  }, [genes]);

  const activeGenes = selectedGenes.length > 0 ? selectedGenes.slice(0, 30) : previewGenes;

  useEffect(() => {
    if (activeGenes.length === 0) return;
    let active = true;
    setError(null);
    fetchDotplot(apiBase, activeGenes)
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
  }, [apiBase, activeGenes]);

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
      height: 520,
    };
    window.Plotly.react(plotRef.current, traces, layout, { displayModeBar: false, responsive: true });
  }, [traces]);

  const toggleGene = (gene: string) => {
    setSelectedGenes((prev) => (
      prev.includes(gene) ? prev.filter((item) => item !== gene) : [...prev, gene]
    ));
  };

  const handleSelectAll = () => {
    setSelectedGenes(genes.slice(0, 30));
  };

  const handleClearAll = () => {
    setSelectedGenes([]);
  };

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
        <div className="field grow">
          <label className="muted small">Genes (select up to 30)</label>
          <div className="scroll-box options">
            {loadingGenes ? (
              <div className="skeleton-lines" />
            ) : (
              <div className="option-list">
                <div className="option-actions">
                  <span className="muted small">{selectedGenes.length} selected</span>
                  <div className="multi-select-actions">
                    <button className="btn ghost small-button" type="button" onClick={handleSelectAll}>Select all</button>
                    <button className="btn ghost small-button" type="button" onClick={handleClearAll}>Clear</button>
                  </div>
                </div>
                {genes.map((gene) => (
                  <label key={gene} className="option-row">
                    <input
                      type="checkbox"
                      checked={selectedGenes.includes(gene)}
                      onChange={() => toggleGene(gene)}
                    />
                    <span>{gene}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="plot-frame large" ref={plotRef} />
    </div>
  );
}
