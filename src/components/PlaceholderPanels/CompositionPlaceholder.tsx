import { useEffect, useMemo, useRef, useState } from "react";
import type { CompositionResponse } from "../../lib/types";
import { DEFAULT_RESOLVED_BASE, fetchComposition } from "../../lib/api";
import { getStoredApiBase } from "../../lib/storage";

export default function CompositionPlaceholder() {
  const apiBase = getStoredApiBase() ?? DEFAULT_RESOLVED_BASE;
  const [response, setResponse] = useState<CompositionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPercentage, setShowPercentage] = useState(false);
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

  const { traces, totals } = useMemo(() => {
    if (!response?.ok || !response.groups || !response.cell_types || !response.counts) {
      return { traces: [], totals: {} };
    }
    if (response.counts.length === 0 || response.groups.length === 0) {
      return { traces: [], totals: {} };
    }

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
      if (!row || !Array.isArray(row)) return;
      const target = mergedIndex[mappedGroups[rowIdx]];
      if (target === undefined) return;
      row.forEach((value, cellIdx) => {
        if (mergedCounts[target]) {
          mergedCounts[target][cellIdx] += value ?? 0;
        }
      });
    });

    // Calculate totals per disease
    const diseaseTotals: Record<string, number> = {};
    mergedGroups.forEach((group, idx) => {
      diseaseTotals[group] = mergedCounts[idx].reduce((sum, val) => sum + val, 0);
    });

    // Build traces - either absolute or percentage
    const builtTraces = response.cell_types.map((cellType, idx) => {
      const yValues = mergedCounts.map((row, groupIdx) => {
        const count = row?.[idx] ?? 0;
        if (showPercentage) {
          const total = diseaseTotals[mergedGroups[groupIdx]] || 1;
          return (count / total) * 100;
        }
        return count;
      });

      // For hover, show both absolute and percentage
      const hoverText = mergedCounts.map((row, groupIdx) => {
        const count = row?.[idx] ?? 0;
        const total = diseaseTotals[mergedGroups[groupIdx]] || 1;
        const pct = ((count / total) * 100).toFixed(1);
        return `${cellType}<br>${mergedGroups[groupIdx]}<br>Count: ${count.toLocaleString()}<br>Percentage: ${pct}%`;
      });

      return {
        type: "bar",
        name: cellType,
        x: mergedGroups,
        y: yValues,
        text: hoverText,
        hoverinfo: "text",
      };
    });

    return { traces: builtTraces, totals: diseaseTotals };
  }, [response, showPercentage]);

  useEffect(() => {
    if (!plotRef.current || !window.Plotly || traces.length === 0) return;
    const layout = {
      barmode: "stack",
      margin: { l: 60, r: 20, t: 10, b: 100 },
      height: 520,
      xaxis: { automargin: true, tickangle: -45 },
      yaxis: {
        automargin: true,
        title: showPercentage ? "Percentage (%)" : "Cell count",
      },
      legend: { orientation: "h" as const, y: -0.35 },
    };
    window.Plotly.react(plotRef.current, traces, layout, { displayModeBar: false, responsive: true });
  }, [traces, showPercentage]);

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <div className="h3">Composition</div>
          <div className="muted small">Cell type composition per disease</div>
        </div>
        <div className="row gap">
          <button
            type="button"
            className={`tab ${!showPercentage ? "on" : ""}`}
            onClick={() => setShowPercentage(false)}
          >
            Absolute
          </button>
          <button
            type="button"
            className={`tab ${showPercentage ? "on" : ""}`}
            onClick={() => setShowPercentage(true)}
          >
            Percentage
          </button>
        </div>
      </div>

      {/* Summary stats */}
      {Object.keys(totals).length > 0 && (
        <div className="composition-stats">
          {Object.entries(totals).map(([disease, total]) => (
            <div key={disease} className="composition-stat">
              <span className="composition-stat-label">{disease}</span>
              <span className="composition-stat-value">{total.toLocaleString()} cells</span>
            </div>
          ))}
        </div>
      )}

      {error ? <div className="error-banner">{error}</div> : null}
      <div className="plot-frame large" ref={plotRef} />
    </div>
  );
}
