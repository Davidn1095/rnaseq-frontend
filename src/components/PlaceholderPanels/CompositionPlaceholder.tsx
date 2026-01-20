import { useEffect, useMemo, useRef, useState } from "react";
import type { CompositionResponse } from "../../lib/types";
import { DEFAULT_RESOLVED_BASE, fetchComposition } from "../../lib/api";
import { getStoredApiBase } from "../../lib/storage";

type CompositionPlaceholderProps = {
  groupBy: "disease" | "accession";
  onGroupByChange: (next: "disease" | "accession") => void;
};

export default function CompositionPlaceholder({ groupBy, onGroupByChange }: CompositionPlaceholderProps) {
  const apiBase = getStoredApiBase() ?? DEFAULT_RESOLVED_BASE;
  const [response, setResponse] = useState<CompositionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const plotRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    setError(null);
    fetchComposition(apiBase, groupBy)
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
  }, [apiBase, groupBy]);

  const traces = useMemo(() => {
    if (!response?.ok || !response.groups || !response.cell_types || !response.counts) return [];
    const groups = response.groups;
    const counts = response.counts;
    return response.cell_types.map((cellType, idx) => ({
      type: "bar",
      name: cellType,
      x: groups,
      y: counts.map((row) => row[idx] ?? 0),
    }));
  }, [response]);

  useEffect(() => {
    if (!plotRef.current || !window.Plotly || traces.length === 0) return;
    const layout = {
      barmode: "stack",
      margin: { l: 50, r: 20, t: 10, b: 70 },
      height: 380,
      xaxis: { automargin: true },
      yaxis: { automargin: true, title: "Cells" },
      legend: { orientation: "h", y: -0.3 },
    };
    window.Plotly.react(plotRef.current, traces, layout, { displayModeBar: false, responsive: true });
  }, [traces]);
  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <div className="h3">Composition</div>
          <div className="muted small">Cell type composition overview</div>
        </div>
        <div className="field">
          <label className="muted small">Group by</label>
          <select
            className="select"
            value={groupBy}
            onChange={(event) => onGroupByChange(event.target.value as "disease" | "accession")}
          >
            <option value="disease">Disease</option>
            <option value="accession">Accession</option>
          </select>
        </div>
      </div>
      {error ? <div className="error-banner">{error}</div> : null}
      <div className="plot-frame" ref={plotRef} />
    </div>
  );
}
