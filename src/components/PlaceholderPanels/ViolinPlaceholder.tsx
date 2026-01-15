import type { ViolinSummary } from "../../lib/types";

type ViolinPlaceholderProps = {
  summaries: ViolinSummary[];
};

export default function ViolinPlaceholder({ summaries }: ViolinPlaceholderProps) {
  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <div className="h3">Violin</div>
          <div className="muted small">
            Distributions rendered from backend histograms or quantiles (not raw per-cell vectors).
          </div>
        </div>
      </div>

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
