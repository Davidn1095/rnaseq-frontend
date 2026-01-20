import { useEffect, useMemo, useRef, useState } from "react";
import type { ViolinResponse } from "../../lib/types";
import { DEFAULT_RESOLVED_BASE, fetchViolin } from "../../lib/api";
import { getStoredApiBase } from "../../lib/storage";

type ViolinPlaceholderProps = {
  genes: string[];
  groupBy?: "cell_type" | "disease";
};

export default function ViolinPlaceholder({ genes, groupBy = "cell_type" }: ViolinPlaceholderProps) {
  const apiBase = getStoredApiBase() ?? DEFAULT_RESOLVED_BASE;
  const gene = genes[0] ?? "IL7R";
  const [response, setResponse] = useState<ViolinResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const plotRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    setError(null);
    fetchViolin(apiBase, gene, groupBy, "quantile")
      .then((res) => {
        if (!active) return;
        if (!res.ok) {
          setError(res.error ?? "Unable to load violin data");
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
  }, [apiBase, gene, groupBy]);

  const rows = useMemo(() => {
    if (!response?.ok || !response.groups || !response.quantiles) return [];
    return response.groups.map((label, index) => ({
      label,
      quantiles: response.quantiles![index],
    }));
  }, [response]);

  const plotTrace = useMemo(() => {
    if (!rows.length) return [];
    return [
      {
        type: "box",
        name: gene,
        x: rows.map((row) => row.label),
        q1: rows.map((row) => row.quantiles?.q1 ?? null),
        median: rows.map((row) => row.quantiles?.median ?? null),
        q3: rows.map((row) => row.quantiles?.q3 ?? null),
        lowerfence: rows.map((row) => row.quantiles?.min ?? null),
        upperfence: rows.map((row) => row.quantiles?.max ?? null),
        marker: { color: "#6366f1" },
      },
    ];
  }, [rows, gene]);

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
          <div className="h3">Violin</div>
          <div className="muted small">
            Distributions rendered from backend histograms or quantiles (not raw per-cell vectors).
          </div>
          <div className="muted small">Gene: {gene} · Group by: {groupBy}</div>
        </div>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="plot-frame large" ref={plotRef} />
    </div>
  );
}
