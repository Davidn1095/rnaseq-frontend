import { useEffect, useMemo, useRef, useState } from "react";
import type { DeResponse, Manifest, Mode } from "../../lib/types";
import { DEFAULT_RESOLVED_BASE, fetchDeByDisease } from "../../lib/api";
import { getStoredApiBase } from "../../lib/storage";

// Colors for different cell populations
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

type VolcanoPlaceholderProps = {
  manifest: Manifest | null;
  mode: Mode;
  disease: string;
  leftDisease: string;
  rightDisease: string;
  selectedCellTypes: string[];
};

type PointData = {
  gene: string;
  logfc: number;
  neglog10: number;
  cellType: string;
  groups?: string[];
};

export default function VolcanoPlaceholder({
  manifest,
  mode,
  disease,
  leftDisease,
  rightDisease,
  selectedCellTypes,
}: VolcanoPlaceholderProps) {
  const apiBase = getStoredApiBase() ?? DEFAULT_RESOLVED_BASE;
  const diseases = useMemo(
    () => (manifest?.diseases ?? []).filter((item) => item !== "Healthy"),
    [manifest],
  );
  const [selectedDisease, setSelectedDisease] = useState(disease || diseases[0] || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, DeResponse>>({});
  const plotRef = useRef<HTMLDivElement | null>(null);

  const mapDiseaseLabel = (value: string) => {
    const normalized = value.trim().toLowerCase();
    if (normalized === "normal") return "Healthy";
    if (normalized === "ra") return "Rheumatoid arthritis";
    if (normalized === "sjs") return "Sjögren syndrome";
    if (normalized === "sle") return "Systemic lupus erythematosus";
    return value;
  };

  // Sync disease selection
  useEffect(() => {
    if (disease && diseases.includes(disease)) {
      setSelectedDisease(disease);
    } else if (diseases.length > 0 && !diseases.includes(selectedDisease)) {
      setSelectedDisease(diseases[0]);
    }
  }, [disease, diseases]);

  // Fetch data for all selected cell types
  useEffect(() => {
    if (mode !== "single") return;
    if (!selectedDisease || selectedCellTypes.length === 0) return;

    setLoading(true);
    setError(null);

    Promise.all(
      selectedCellTypes.map((cellType) =>
        fetchDeByDisease(apiBase, selectedDisease, cellType, 500, 0, 6)
          .then((res) => ({ cellType, res }))
      )
    )
      .then((results) => {
        const newResponses: Record<string, DeResponse> = {};
        results.forEach(({ cellType, res }) => {
          if (res.ok) {
            newResponses[cellType] = res;
          }
        });
        setResponses(newResponses);
        if (Object.keys(newResponses).length === 0) {
          setError("No data available for selected cell types");
        }
      })
      .catch((err) => {
        setError(String((err as Error).message ?? err));
        setResponses({});
      })
      .finally(() => {
        setLoading(false);
      });
  }, [mode, selectedDisease, selectedCellTypes, apiBase]);

  // Build points for all cell types and group genes in tables
  const { allPoints, topUp, topDown } = useMemo(() => {
    const points: PointData[] = [];
    const upGenesMap = new Map<string, { gene: string; logfc: number; cellTypes: string[]; groups: string[] }>();
    const downGenesMap = new Map<string, { gene: string; logfc: number; cellTypes: string[]; groups: string[] }>();

    selectedCellTypes.forEach((cellType) => {
      const res = responses[cellType];
      if (!res?.ok || !res.rows) return;

      res.rows.forEach((row) => {
        const padj = Math.max(row.p_val_adj ?? row.p_val ?? 1, 1e-300);
        const point: PointData = {
          gene: row.gene,
          logfc: row.logfc,
          neglog10: -Math.log10(padj),
          cellType,
          groups: Array.isArray(row.groups) ? row.groups : [],
        };
        points.push(point);
      });

      // Get top up/down for this cell type and group by gene
      if (res.top_up) {
        res.top_up.slice(0, 5).forEach((row) => {
          const existing = upGenesMap.get(row.gene);
          const groups = Array.isArray(row.groups) ? row.groups : [];
          if (existing) {
            existing.cellTypes.push(cellType);
            // Merge groups, avoiding duplicates
            groups.forEach(g => {
              if (!existing.groups.includes(g)) existing.groups.push(g);
            });
          } else {
            upGenesMap.set(row.gene, {
              gene: row.gene,
              logfc: row.logfc,
              cellTypes: [cellType],
              groups: [...groups],
            });
          }
        });
      }
      if (res.top_down) {
        res.top_down.slice(0, 5).forEach((row) => {
          const existing = downGenesMap.get(row.gene);
          const groups = Array.isArray(row.groups) ? row.groups : [];
          if (existing) {
            existing.cellTypes.push(cellType);
            // Merge groups, avoiding duplicates
            groups.forEach(g => {
              if (!existing.groups.includes(g)) existing.groups.push(g);
            });
          } else {
            downGenesMap.set(row.gene, {
              gene: row.gene,
              logfc: row.logfc,
              cellTypes: [cellType],
              groups: [...groups],
            });
          }
        });
      }
    });

    return {
      allPoints: points,
      topUp: Array.from(upGenesMap.values()),
      topDown: Array.from(downGenesMap.values()),
    };
  }, [responses, selectedCellTypes]);

  // Build traces for each cell type
  useEffect(() => {
    if (!plotRef.current || !window.Plotly || allPoints.length === 0) return;

    const traces = selectedCellTypes.map((cellType) => {
      const cellPoints = allPoints.filter((p) => p.cellType === cellType);
      const population = classifyPopulation(cellType);
      const color = POPULATION_COLORS[population] || POPULATION_COLORS["Other"];

      return {
        type: "scatter",
        mode: "markers",
        name: cellType,
        x: cellPoints.map((p) => p.logfc),
        y: cellPoints.map((p) => p.neglog10),
        text: cellPoints.map((p) => p.gene),
        hovertext: cellPoints.map((p) =>
          `<b>${p.gene}</b><br>Cell type: ${p.cellType}<br>logFC: ${p.logfc.toFixed(3)}<br>-log10(padj): ${p.neglog10.toFixed(2)}${p.groups?.length ? `<br>Groups: ${p.groups.join(", ")}` : ""}`
        ),
        hoverinfo: "text",
        marker: {
          size: 7,
          color,
          opacity: 0.7,
        },
      };
    });

    const maxY = Math.max(...allPoints.map((p) => p.neglog10), 10);

    const layout = {
      margin: { l: 50, r: 10, t: 10, b: 50 },
      height: 500,
      xaxis: { title: "logFC", zeroline: true, zerolinecolor: "#e2e8f0" },
      yaxis: { title: "-log10(padj)" },
      legend: {
        orientation: "v" as const,
        y: 0.5,
        yanchor: "middle" as const,
        x: 1.02,
        xanchor: "left" as const,
      },
      shapes: [
        { type: "line", x0: 0, x1: 0, y0: 0, y1: maxY, line: { color: "#cbd5e1", width: 1, dash: "dot" } },
      ],
    };

    window.Plotly.react(plotRef.current, traces, layout, { displayModeBar: false, responsive: true });
  }, [allPoints, selectedCellTypes]);

  if (selectedCellTypes.length === 0) {
    return (
      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="h3">Volcano</div>
            <div className="muted small">Select cell types in Analysis Setup to view differential expression</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <div className="h3">Volcano</div>
          <div className="muted small">
            Differential expression: {mapDiseaseLabel(selectedDisease)} vs Healthy
          </div>
        </div>
      </div>

      <div className="panel-controls">
        <label className="control">
          <span>Disease</span>
          <select
            value={selectedDisease}
            onChange={(event) => setSelectedDisease(event.target.value)}
            disabled={mode !== "single"}
          >
            {diseases.map((item) => (
              <option key={item} value={item}>
                {mapDiseaseLabel(item)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? <div className="muted small" style={{ marginTop: 12 }}>Loading...</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      {allPoints.length > 0 ? (
        <>
          <div className="plot-frame" ref={plotRef} style={{ height: 500 }} />

          {/* Tables for top up/down regulated genes */}
          <div className="panel-grid" style={{ marginTop: 16 }}>
            <div>
              <div className="h4" style={{ color: "#ef4444", marginBottom: 8 }}>Top upregulated</div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Gene</th>
                    <th>logFC</th>
                    <th>Cell type</th>
                    <th>Functional groups</th>
                  </tr>
                </thead>
                <tbody>
                  {topUp.length === 0 ? (
                    <tr><td colSpan={4} className="muted">No data</td></tr>
                  ) : (
                    topUp.map((row, idx) => (
                      <tr key={`up-${row.gene}-${idx}`}>
                        <td><strong>{row.gene}</strong></td>
                        <td style={{ color: "#ef4444" }}>+{row.logfc.toFixed(2)}</td>
                        <td>{row.cellTypes.join(", ")}</td>
                        <td className="muted small">{row.groups?.length ? row.groups.join(", ") : "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div>
              <div className="h4" style={{ color: "#3b82f6", marginBottom: 8 }}>Top downregulated</div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Gene</th>
                    <th>logFC</th>
                    <th>Cell type</th>
                    <th>Functional groups</th>
                  </tr>
                </thead>
                <tbody>
                  {topDown.length === 0 ? (
                    <tr><td colSpan={4} className="muted">No data</td></tr>
                  ) : (
                    topDown.map((row, idx) => (
                      <tr key={`down-${row.gene}-${idx}`}>
                        <td><strong>{row.gene}</strong></td>
                        <td style={{ color: "#3b82f6" }}>{row.logfc.toFixed(2)}</td>
                        <td>{row.cellTypes.join(", ")}</td>
                        <td className="muted small">{row.groups?.length ? row.groups.join(", ") : "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : !loading && !error ? (
        <div className="muted small" style={{ marginTop: 12 }}>No data available for this selection</div>
      ) : null}
    </div>
  );
}
