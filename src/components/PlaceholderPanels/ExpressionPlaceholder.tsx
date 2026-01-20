import { useEffect, useMemo, useRef, useState } from "react";
import type { Mode, ViolinResponse } from "../../lib/types";
import { DEFAULT_RESOLVED_BASE, fetchViolin } from "../../lib/api";
import { getStoredApiBase } from "../../lib/storage";

type ExpressionPlaceholderProps = {
  mode: Mode;
  disease: string;
  leftDisease: string;
  rightDisease: string;
  genes: string[];
};

export default function ExpressionPlaceholder({
  mode,
  disease,
  leftDisease,
  rightDisease,
  genes,
}: ExpressionPlaceholderProps) {
  const apiBase = getStoredApiBase() ?? DEFAULT_RESOLVED_BASE;
  const groupLabel = mode === "single"
    ? `Healthy, ${disease}`
    : `Healthy, ${leftDisease}, ${rightDisease}`;

  const previewGenes = genes.slice(0, 6);
  const [selectedGene, setSelectedGene] = useState<string>(genes[0] ?? "IL7R");
  const [response, setResponse] = useState<ViolinResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const plotRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (genes.length > 0 && !genes.includes(selectedGene)) {
      setSelectedGene(genes[0]);
    }
  }, [genes, selectedGene]);

  useEffect(() => {
    let active = true;
    setError(null);
    fetchViolin(apiBase, selectedGene, "disease", "quantile")
      .then((res) => {
        if (!active) return;
        if (!res.ok) {
          setError(res.error ?? "Unable to load expression summary");
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
  }, [apiBase, selectedGene]);

  const summaries = useMemo(() => {
    if (!response?.ok || !response.groups || !response.quantiles) return [];
    return response.groups.map((label, index) => ({
      label,
      quantiles: response.quantiles![index],
    }));
  }, [response]);

  const plotTrace = useMemo(() => {
    if (!summaries.length) return [];
    return [
      {
        type: "box",
        name: selectedGene,
        x: summaries.map((s) => s.label),
        q1: summaries.map((s) => s.quantiles?.q1 ?? null),
        median: summaries.map((s) => s.quantiles?.median ?? null),
        q3: summaries.map((s) => s.quantiles?.q3 ?? null),
        lowerfence: summaries.map((s) => s.quantiles?.min ?? null),
        upperfence: summaries.map((s) => s.quantiles?.max ?? null),
        marker: { color: "#2563eb" },
      },
    ];
  }, [summaries, selectedGene]);

  useEffect(() => {
    if (!plotRef.current || !window.Plotly || plotTrace.length === 0) return;
    const layout = {
      margin: { l: 60, r: 20, t: 10, b: 90 },
      height: 520,
      yaxis: { title: "Expression" },
      xaxis: { automargin: true },
    };
    window.Plotly.react(plotRef.current, plotTrace, layout, { displayModeBar: false, responsive: true });
  }, [plotTrace]);

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <div className="h3">Expression</div>
          <div className="muted small">Per-cell distributions for selected gene(s).</div>
          <div className="muted small">Groups: {groupLabel}</div>
        </div>
        <div className="muted small">Gene: {selectedGene}</div>
      </div>

      <div className="row gap top">
        <div className="field">
          <label className="muted small">Gene</label>
          <select
            className="select"
            value={selectedGene}
            onChange={(event) => setSelectedGene(event.target.value)}
          >
            {(genes.length > 0 ? genes : ["IL7R"]).map((gene) => (
              <option key={gene} value={gene}>{gene}</option>
            ))}
          </select>
        </div>
        <div className="field grow">
          <label className="muted small">Selected genes (preview)</label>
          <div className="scroll-box">
            {previewGenes.length > 0 ? (
              <ul>
                {previewGenes.map((gene) => (
                  <li key={gene}>{gene}</li>
                ))}
              </ul>
            ) : (
              <div className="muted small">No genes selected yet.</div>
            )}
          </div>
        </div>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="plot-frame large" ref={plotRef} />
    </div>
  );
}
