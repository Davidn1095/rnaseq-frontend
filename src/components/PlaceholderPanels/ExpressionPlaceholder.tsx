import { useEffect, useMemo, useState } from "react";
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
  const primaryGene = previewGenes[0] ?? "IL7R";
  const [response, setResponse] = useState<ViolinResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setError(null);
    fetchViolin(apiBase, primaryGene, "disease", "quantile")
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
  }, [apiBase, primaryGene]);

  const summaries = useMemo(() => {
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
          <div className="h3">Expression</div>
          <div className="muted small">Per-cell distributions for selected gene(s).</div>
          <div className="muted small">Groups: {groupLabel}</div>
        </div>
        <div className="muted small">Gene: {primaryGene}</div>
      </div>

      <div className="row gap top">
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
            {summaries.map((summary) => (
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
