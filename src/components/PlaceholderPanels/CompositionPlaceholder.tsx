import { useEffect, useMemo, useRef, useState } from "react";
import type { CompositionResponse } from "../../lib/types";
import { DEFAULT_RESOLVED_BASE, fetchComposition } from "../../lib/api";
import { getStoredApiBase } from "../../lib/storage";

export default function CompositionPlaceholder() {
  const apiBase = getStoredApiBase() ?? DEFAULT_RESOLVED_BASE;
  const [response, setResponse] = useState<CompositionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const plotRef = useRef<HTMLDivElement | null>(null);

  const mapDiseaseLabel = (value: string) => {
    const normalized = value.trim().toLowerCase();
    if (normalized === "normal") return "Healthy";
    if (normalized === "ra" || normalized === "rheumatoid arthritis") return "Rheumatoid arthritis";
    if (normalized === "sjs") return "Sjögren syndrome";
    if (normalized === "sle" || normalized === "systemic lupus erythematosus") return "Systemic lupus erythematosus";
    return value;
  };

  useEffect(() => {
    let active = true;
    setError(null);
    fetchComposition(apiBase, "disease")
      .then((res) => {
        if (!active) return;
        if (!res.ok) {
          setError(res.error ?? "Unable to load composition");
          setResponse(null);
          return;
        }
        setResponse(res);
      })
      .catch((err) => {
        if (!active) return;
        setError(String((err as Error).message ?? err));
        setResponse(null);
      });
    return () => {
      active = false;
    };
  }, [apiBase]);

  const traces = useMemo(() => {
    if (!response?.ok || !response.groups || !response.cell_types || !response.counts) return [];
    const mappedGroups = response.groups.map((group) => mapDiseaseLabel(group));
    const mergedIndex: Record<string, number> = {};
    const mergedGroups: string[] = [];
    mappedGroups.forEach((label) => {
      if (mergedIndex[label] === undefined) {
        mergedIndex[label] = mergedGroups.length;
        mergedGroups.push(label);
      }
    });
    const mergedCounts = mergedGroups.map(() => Array(response.cell_types!.length).fill(0));
    response.counts.forEach((row, rowIdx) => {
      const target = mergedIndex[mappedGroups[rowIdx]];
      row.forEach((value, cellIdx) => {
        mergedCounts[target][cellIdx] += value ?? 0;
      });
    });
    return response.cell_types.map((cellType, idx) => ({
      type: "bar",
      name: cellType,
      x: mergedGroups,
      y: mergedCounts.map((row) => row[idx] ?? 0),
    }));
  }, [response]);

  useEffect(() => {
    if (!plotRef.current || !window.Plotly || traces.length === 0) return;
    const layout = {
      barmode: "stack",
      margin: { l: 50, r: 20, t: 10, b: 70 },
      height: 520,
      xaxis: { automargin: true },
      yaxis: { automargin: true, title: "Cells" },
      legend: { orientation: "h", y: -0.3 },
    };
    window.Plotly.react(plotRef.current, traces, layout, { displayModeBar: false, responsive: true });
  }, [traces]);
  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <div className="h3">Composition</div>
          <div className="muted small">Cell type composition overview</div>
        </div>
      </div>
      {error ? <div className="error-banner">{error}</div> : null}
      <div className="plot-frame large" ref={plotRef} />
    </div>
  );
}
