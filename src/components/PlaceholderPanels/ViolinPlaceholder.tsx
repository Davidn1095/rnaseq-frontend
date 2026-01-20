import { useEffect, useMemo, useState } from "react";
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

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Group</th>
              <th>Min</th>
              <th>Q1</th>
              <th>Median</th>
              <th>Q3</th>
              <th>Max</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((summary) => (
              <tr key={summary.label}>
                <td>{summary.label}</td>
                <td>{summary.quantiles?.min ?? "—"}</td>
                <td>{summary.quantiles?.q1 ?? "—"}</td>
                <td>{summary.quantiles?.median ?? "—"}</td>
                <td>{summary.quantiles?.q3 ?? "—"}</td>
                <td>{summary.quantiles?.max ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
