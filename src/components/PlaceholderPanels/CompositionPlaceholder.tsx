import { useEffect, useMemo, useRef, useState } from "react";
import type { CompositionResponse } from "../../lib/types";
import { DEFAULT_RESOLVED_BASE, fetchComposition } from "../../lib/api";
import { getStoredApiBase } from "../../lib/storage";

// Population colors
const POPULATION_COLORS: Record<string, string> = {
  "T cells": "#2563eb",
  "B cells": "#16a34a",
  "NK cells": "#dc2626",
  "Monocytes": "#ea580c",
  "Myeloid/DC": "#9333ea",
  "Neutrophils": "#0891b2",
  "Basophils": "#db2777",
  "Plasma": "#ca8a04",
  "Progenitors": "#6366f1",
  "Other": "#64748b",
};

// Classify cell type into population
function classifyPopulation(label: string): string {
  const name = label.toLowerCase();
  if (
    name.includes("t cells") ||
    name.includes("t cell") ||
    name.includes("cd4") ||
    name.includes("cd8") ||
    name.includes("tcr") ||
    name.includes("gd t") ||
    name.includes("gamma delta") ||
    name.includes("th1") ||
    name.includes("th2") ||
    name.includes("th17") ||
    name.includes("treg") ||
    name.includes("t regulatory") ||
    name.includes("regulatory t") ||
    name.includes("t helper") ||
    name.includes("helper t") ||
    name.includes("mait")
  ) {
    return "T cells";
  }
  if (name.includes("b cells") || name.includes("b cell")) {
    return "B cells";
  }
  if (name.includes("nk") || name.includes("natural killer")) {
    return "NK cells";
  }
  if (name.includes("monocyte")) {
    return "Monocytes";
  }
  if (name.includes("dendritic") || name.includes("dc") || name.includes("myeloid")) {
    return "Myeloid/DC";
  }
  if (name.includes("neutrophil")) {
    return "Neutrophils";
  }
  if (name.includes("basophil")) {
    return "Basophils";
  }
  if (name.includes("plasma") || name.includes("plasmablast")) {
    return "Plasma";
  }
  if (name.includes("progenitor") || name.includes("stem")) {
    return "Progenitors";
  }
  return "Other";
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

    // Aggregate by population (only including selected cell types if filter is active)
    const populations = Object.keys(POPULATION_COLORS);
    const populationCounts: Record<string, Record<string, number>> = {};

    populations.forEach((pop) => {
      populationCounts[pop] = {};
      mergedGroups.forEach((disease) => {
        populationCounts[pop][disease] = 0;
      });
    });

    response.cell_types.forEach((cellType, cellIdx) => {
      // Skip cell types not in selection (if filtering)
      if (filterCellTypes && !selectedSet.has(cellType)) return;

      const population = classifyPopulation(cellType);
      mergedGroups.forEach((disease, diseaseIdx) => {
        populationCounts[population][disease] += mergedCounts[diseaseIdx][cellIdx];
      });
    });

    // Calculate totals per disease
    const diseaseTotals: Record<string, number> = {};
    mergedGroups.forEach((disease) => {
      diseaseTotals[disease] = populations.reduce(
        (sum, pop) => sum + populationCounts[pop][disease],
        0
      );
    });

    // Build traces with percentages
    const builtTraces = populations
      .filter((pop) => {
        // Only include populations that have any cells
        return mergedGroups.some((disease) => populationCounts[pop][disease] > 0);
      })
      .map((population) => {
        const yValues = mergedGroups.map((disease) => {
          const count = populationCounts[population][disease];
          const total = diseaseTotals[disease] || 1;
          return (count / total) * 100;
        });

        const hoverText = mergedGroups.map((disease) => {
          const count = populationCounts[population][disease];
          const total = diseaseTotals[disease] || 1;
          const pct = ((count / total) * 100).toFixed(1);
          return `<b>${population}</b><br>${disease}<br>Count: ${count.toLocaleString()}<br>Percentage: ${pct}%`;
        });

        return {
          type: "bar",
          name: population,
          x: mergedGroups,
          y: yValues,
          text: hoverText,
          hoverinfo: "text",
          marker: {
            color: POPULATION_COLORS[population],
          },
        };
      });

    return { traces: builtTraces, totals: diseaseTotals };
  }, [response, selectedCellTypes]);

  useEffect(() => {
    if (!plotRef.current || !window.Plotly || traces.length === 0) return;
    const layout = {
      barmode: "stack",
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
    window.Plotly.react(plotRef.current, traces, layout, { displayModeBar: false, responsive: true });
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
