import { useEffect, useMemo, useRef, useState } from "react";
import type { Mode } from "../../lib/types";
import type { UmapResponse } from "../../lib/types";
import { DEFAULT_RESOLVED_BASE, fetchUmap } from "../../lib/api";
import { getStoredApiBase } from "../../lib/storage";

type UMAPPlaceholderProps = {
  mode: Mode;
  selectedCellTypes: string[];
  disease: string;
  leftDisease: string;
  rightDisease: string;
};

export default function UMAPPlaceholder({
  mode,
  selectedCellTypes,
  disease,
  leftDisease,
  rightDisease,
}: UMAPPlaceholderProps) {
  const apiBase = getStoredApiBase() ?? DEFAULT_RESOLVED_BASE;
  const cohortLabel = mode === "single" ? disease : `${leftDisease} + ${rightDisease}`;
  const cellTypeLabel = selectedCellTypes.length > 0 ? selectedCellTypes.join(", ") : "None selected";
  const plotRef = useRef<HTMLDivElement | null>(null);
  const [umap, setUmap] = useState<UmapResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setError(null);
    fetchUmap(apiBase, mode === "single" ? disease : null, 10000)
      .then((res) => {
        if (!active) return;
        if (!res.ok) {
          setError(res.error ?? "Unable to load UMAP");
          setUmap(null);
          return;
        }
        if ((res.x?.length ?? 0) === 0) {
          setError("No UMAP points match the selected disease.");
          setUmap(res);
          return;
        }
        setUmap(res);
      })
      .catch((err) => {
        if (!active) return;
        setError(String((err as Error).message ?? err));
        setUmap(null);
      });
    return () => {
      active = false;
    };
  }, [apiBase, disease, mode]);

  const clusterTraces = useMemo(() => {
    if (!umap?.x || !umap?.y || !umap?.color) return [];
    const categories = Array.from(new Set(umap.color));
    return categories.map((label) => {
      const idx = umap.color!.map((v, i) => (v === label ? i : -1)).filter((i) => i >= 0);
      return {
        type: "scattergl",
        mode: "markers",
        name: label,
        x: idx.map((i) => umap.x![i]),
        y: idx.map((i) => umap.y![i]),
        marker: {
          size: 5,
          opacity: 0.85,
        },
      };
    });
  }, [umap]);
  const layout = useMemo(
    () => ({
      margin: { l: 40, r: 20, t: 10, b: 40 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      xaxis: { title: "UMAP 1", zeroline: false, showgrid: false },
      yaxis: { title: "UMAP 2", zeroline: false, showgrid: false },
      showlegend: true,
      legend: { orientation: "h", x: 0, y: -0.2 },
      height: 520,
    }),
    [],
  );
  const config = useMemo(() => ({ displayModeBar: false, responsive: true }), []);

  useEffect(() => {
    if (!plotRef.current || !window.Plotly) return;
    if (clusterTraces.length === 0) return;
    window.Plotly.react(plotRef.current, clusterTraces, layout, config);
  }, [clusterTraces, layout, config]);

  useEffect(() => {
    if (!plotRef.current || !window.Plotly) return;
    const handleResize = () => {
      if (!plotRef.current) return;
      window.Plotly.Plots.resize(plotRef.current);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <div className="h3">UMAP</div>
          <div className="muted small">Cohort: {cohortLabel} · Cell types: {cellTypeLabel}</div>
          {error ? <div className="muted small">UMAP error: {error}</div> : null}
        </div>
        <div className="legend">
          <span className="legend-item"><span className="dot" />Disease</span>
          <span className="legend-item"><span className="dot" />Accession</span>
          <span className="legend-item"><span className="dot" />Cell type</span>
        </div>
      </div>

      <div className="plot-frame large" ref={plotRef} />
    </div>
  );
}
