import { useEffect, useMemo, useRef } from "react";
import type { Mode } from "../../lib/types";

type UMAPPlaceholderProps = {
  mode: Mode;
  selectedCellTypes: string[];
  cohortAccessionCount: number;
  disease: string;
  leftDisease: string;
  rightDisease: string;
};

export default function UMAPPlaceholder({
  mode,
  selectedCellTypes,
  cohortAccessionCount,
  disease,
  leftDisease,
  rightDisease,
}: UMAPPlaceholderProps) {
  const cohortLabel = mode === "single" ? disease : `${leftDisease} + ${rightDisease}`;
  const cellTypeLabel = selectedCellTypes.length > 0 ? selectedCellTypes.join(", ") : "None selected";
  const plotRef = useRef<HTMLDivElement | null>(null);
  const clusterTraces = useMemo(() => {
    const totalPoints = Math.max(320, Math.min(1600, cohortAccessionCount * 40));
    const pointsPerCluster = Math.max(80, Math.floor(totalPoints / 3));
    const clusters = [
      { label: "Disease", color: "#60a5fa", center: [-2.2, 1.6] },
      { label: "Healthy", color: "#93c5fd", center: [1.4, 2.3] },
      { label: "Other", color: "#cbd5f5", center: [0.8, -1.8] },
    ];

    return clusters.map((cluster) => {
      const x = Array.from({ length: pointsPerCluster }, (_, index) => {
        const jitter = (index % 7) * 0.05;
        return cluster.center[0] + Math.cos(index / 10) * 1.4 + jitter;
      });
      const y = Array.from({ length: pointsPerCluster }, (_, index) => {
        const jitter = ((index * 13) % 11) * 0.04;
        return cluster.center[1] + Math.sin(index / 12) * 1.2 + jitter;
      });
      return {
        type: "scattergl",
        mode: "markers",
        name: cluster.label,
        x,
        y,
        marker: {
          size: 5,
          color: cluster.color,
          opacity: 0.85,
        },
      };
    });
  }, [cohortAccessionCount]);
  const layout = useMemo(
    () => ({
      margin: { l: 40, r: 20, t: 10, b: 40 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      xaxis: { title: "UMAP 1", zeroline: false, showgrid: false },
      yaxis: { title: "UMAP 2", zeroline: false, showgrid: false },
      showlegend: true,
      legend: { orientation: "h", x: 0, y: -0.2 },
    }),
    [],
  );
  const config = useMemo(() => ({ displayModeBar: false, responsive: true }), []);

  useEffect(() => {
    if (!plotRef.current || !window.Plotly) return;
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
          <div className="muted small">Accessions in cohort: {cohortAccessionCount}</div>
        </div>
        <div className="legend">
          <span className="legend-item"><span className="dot" />Disease</span>
          <span className="legend-item"><span className="dot" />Accession</span>
          <span className="legend-item"><span className="dot" />Cell type</span>
        </div>
      </div>

      <div className="plot-frame" ref={plotRef} />
    </div>
  );
}
