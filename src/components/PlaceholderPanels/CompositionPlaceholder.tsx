import { useEffect, useMemo, useRef, useState } from "react";
import type { CompositionResponse } from "../../lib/types";
import { DEFAULT_RESOLVED_BASE, fetchComposition } from "../../lib/api";
import { getStoredApiBase } from "../../lib/storage";

// Generate color palette with distinct colors
function generateColorPalette(count: number): string[] {
  const hueStep = 360 / count;
  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    const hue = (i * hueStep) % 360;
    const saturation = 60 + (i % 3) * 15;
    const lightness = 45 + (i % 2) * 10;
    colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
  }
  return colors;
}

type CompositionPlaceholderProps = {
  selectedCellTypes: string[];
};

export default function CompositionPlaceholder({ selectedCellTypes }: CompositionPlaceholderProps) {
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

  const { traces, totals } = useMemo(() => {
    if (!response?.ok || !response.groups || !response.cell_types || !response.counts) {
      return { traces: [], totals: {} };
    }
    if (response.counts.length === 0 || response.groups.length === 0) {
      return { traces: [], totals: {} };
    }

    // Filter cell types based on selection (if any selected)
    const filterCellTypes = selectedCellTypes.length > 0;
    const selectedSet = new Set(selectedCellTypes);

    // Map and merge disease groups
    const mappedGroups = response.groups.map((group) => mapDiseaseLabel(group));
    const mergedIndex: Record<string, number> = {};
    const mergedGroups: string[] = [];
    mappedGroups.forEach((label) => {
      if (mergedIndex[label] === undefined) {
        mergedIndex[label] = mergedGroups.length;
        mergedGroups.push(label);
      }
    });

    // Merge counts by disease
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

    // Use subpopulations (actual cell types) instead of aggregated populations
    // Filter cell types based on selection
    const cellTypesToShow = response.cell_types.filter((cellType) => {
      if (!filterCellTypes) return true;
      return selectedSet.has(cellType);
    });

    // Calculate totals per disease
    const diseaseTotals: Record<string, number> = {};
    mergedGroups.forEach((disease, diseaseIdx) => {
      let total = 0;
      response.cell_types.forEach((cellType, cellIdx) => {
        if (filterCellTypes && !selectedSet.has(cellType)) return;
        total += mergedCounts[diseaseIdx][cellIdx];
      });
      diseaseTotals[disease] = total;
    });

    // Generate unique colors for each subpopulation
    const colorPalette = generateColorPalette(cellTypesToShow.length);

    // Build traces with percentages for each cell type (subpopulation)
    const builtTraces = cellTypesToShow.map((cellType, idx) => {
        const cellIdx = response.cell_types.indexOf(cellType);
        const yValues = mergedGroups.map((disease, diseaseIdx) => {
          const count = mergedCounts[diseaseIdx][cellIdx];
          const total = diseaseTotals[disease] || 1;
          return (count / total) * 100;
        });

        const hoverText = mergedGroups.map((disease, diseaseIdx) => {
          const count = mergedCounts[diseaseIdx][cellIdx];
          const total = diseaseTotals[disease] || 1;
          const pct = ((count / total) * 100).toFixed(1);
          return `<b>${cellType}</b><br>${disease}<br>Count: ${count.toLocaleString()}<br>Percentage: ${pct}%`;
        });

        return {
          type: "bar",
          name: cellType,
          x: mergedGroups,
          y: yValues,
          hovertext: hoverText,
          hoverinfo: "text",
          textposition: "none",
          marker: {
            color: colorPalette[idx],
            line: {
              width: 0,
            },
          },
        };
      });

    return { traces: builtTraces, totals: diseaseTotals };
  }, [response, selectedCellTypes]);

  useEffect(() => {
    if (!plotRef.current || !window.Plotly || traces.length === 0) return;
    const layout = {
      barmode: "stack",
      bargap: 0.2,
      margin: { l: 60, r: 20, t: 10, b: 100 },
      height: 520,
      xaxis: { automargin: true, tickangle: -45 },
      yaxis: {
        automargin: true,
        title: "Percentage (%)",
        range: [0, 100],
      },
      legend: { orientation: "h" as const, y: -0.3 },
    };
    window.Plotly.react(plotRef.current, traces, layout, { displayModeBar: false, responsive: true }).then(() => {
      // Apply rounded corners to bar chart paths
      const bars = plotRef.current?.querySelectorAll('.bars path');
      bars?.forEach((bar) => {
        bar.setAttribute('rx', '4');
        bar.setAttribute('ry', '4');
      });
    });
  }, [traces]);

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <div className="h3">Composition</div>
          <div className="muted small">
            Cell population composition per disease (%)
            {selectedCellTypes.length > 0 ? ` — Filtered: ${selectedCellTypes.length} cell types` : " — All cell types"}
          </div>
        </div>
      </div>

      {/* Summary stats */}
      {Object.keys(totals).length > 0 && (
        <div className="composition-stats">
          {Object.entries(totals).map(([disease, total]) => (
            <div key={disease} className="composition-stat">
              <span className="composition-stat-label">{disease}</span>
              <span className="composition-stat-value">{(total as number).toLocaleString()} cells</span>
            </div>
          ))}
        </div>
      )}

      {error ? <div className="error-banner">{error}</div> : null}
      <div className="plot-frame large" ref={plotRef} />
    </div>
  );
}
