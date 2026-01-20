import { useEffect, useMemo, useRef, useState } from "react";
import type { DeResponse, Manifest, Mode } from "../../lib/types";
import { DEFAULT_RESOLVED_BASE, fetchDeByDisease } from "../../lib/api";
import { getStoredApiBase } from "../../lib/storage";

type VolcanoPlaceholderProps = {
  manifest: Manifest | null;
  mode: Mode;
  disease: string;
  leftDisease: string;
  rightDisease: string;
  selectedCellTypes: string[];
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
  const [selectedCellType, setSelectedCellType] = useState(selectedCellTypes[0] || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<DeResponse | null>(null);
  const plotRef = useRef<HTMLDivElement | null>(null);

  const mapDiseaseLabel = (value: string) => {
    const normalized = value.trim().toLowerCase();
    if (normalized === "normal") return "Healthy";
    if (normalized === "ra" || normalized === "rheumatoid arthritis") return "Rheumatoid arthritis";
    if (normalized === "sjs") return "Sjögren syndrome";
    if (normalized === "sle" || normalized === "systemic lupus erythematosus") return "Systemic lupus erythematosus";
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

  // Sync cell type selection from Analysis Setup
  useEffect(() => {
    if (selectedCellTypes.length > 0) {
      setSelectedCellType(selectedCellTypes[0]);
    }
  }, [selectedCellTypes]);

  const handleFetch = async () => {
    if (!selectedDisease || !selectedCellType) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDeByDisease(apiBase, selectedDisease, selectedCellType, 500, 0, 6);
      if (!res.ok) {
        throw new Error(res.error ?? "Request failed");
      }
      setResponse(res);
    } catch (err) {
      setError(String((err as Error).message ?? err));
      setResponse(null);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch when selections change
  useEffect(() => {
    if (mode !== "single") return;
    if (!selectedDisease || !selectedCellType) return;
    handleFetch();
  }, [mode, selectedDisease, selectedCellType]);

  const points = useMemo(() => {
    if (!response?.ok || !response.rows) return [];
    return response.rows.map((row) => {
      const padj = Math.max(row.p_val_adj ?? row.p_val ?? 1, 1e-300);
      return {
        gene: row.gene,
        logfc: row.logfc,
        neglog10: -Math.log10(padj),
      };
    });
  }, [response]);

  useEffect(() => {
    if (!plotRef.current || !window.Plotly || points.length === 0) return;
    const trace = {
      type: "scatter",
      mode: "markers+text",
      x: points.map((p) => p.logfc),
      y: points.map((p) => p.neglog10),
      text: points.map((p) => p.gene),
      textposition: "top center",
      textfont: { size: 9, color: "#64748b" },
      hovertext: points.map((p) => `${p.gene}<br>logFC: ${p.logfc.toFixed(3)}<br>-log10(padj): ${p.neglog10.toFixed(2)}`),
      hoverinfo: "text",
      marker: {
        size: 8,
        color: points.map((p) => (p.logfc >= 0 ? "#ef4444" : "#3b82f6")),
        opacity: 0.8,
      },
    };
    const layout = {
      margin: { l: 60, r: 20, t: 30, b: 60 },
      height: 520,
      xaxis: { title: "logFC", zeroline: true, zerolinecolor: "#e2e8f0" },
      yaxis: { title: "-log10(padj)" },
      shapes: [
        { type: "line", x0: 0, x1: 0, y0: 0, y1: Math.max(...points.map(p => p.neglog10), 10), line: { color: "#cbd5e1", width: 1, dash: "dot" } },
      ],
    };
    window.Plotly.react(plotRef.current, [trace], layout, { displayModeBar: false, responsive: true });
  }, [points]);

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
            Differential expression: Disease vs Healthy (pseudobulk)
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
        <label className="control">
          <span>Cell type</span>
          <select
            value={selectedCellType}
            onChange={(event) => setSelectedCellType(event.target.value)}
          >
            {selectedCellTypes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? <div className="muted small" style={{ marginTop: 12 }}>Loading...</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      {response?.ok && response.rows && points.length > 0 ? (
        <div className="plot-frame large" ref={plotRef} />
      ) : !loading && !error ? (
        <div className="muted small" style={{ marginTop: 12 }}>No data available for this selection</div>
      ) : null}
    </div>
  );
}
