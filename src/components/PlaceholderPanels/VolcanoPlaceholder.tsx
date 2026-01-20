import { useEffect, useMemo, useState } from "react";
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
  const cellTypes = useMemo(() => manifest?.cell_types ?? [], [manifest]);
  const [selectedDisease, setSelectedDisease] = useState(disease || diseases[0] || "");
  const [selectedCellType, setSelectedCellType] = useState(selectedCellTypes[0] || cellTypes[0] || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<DeResponse | null>(null);

  useEffect(() => {
    if (!selectedDisease && disease) {
      setSelectedDisease(disease);
    }
  }, [disease, selectedDisease]);

  useEffect(() => {
    if (!selectedCellType && selectedCellTypes.length > 0) {
      setSelectedCellType(selectedCellTypes[0]);
    }
  }, [selectedCellType, selectedCellTypes]);

  const handleFetch = async () => {
    if (!selectedDisease || !selectedCellType) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDeByDisease(apiBase, selectedDisease, selectedCellType, 50, 0, 6);
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

  const diseaseLabel = mode === "single" ? disease : `${leftDisease} and ${rightDisease}`;
  const cellTypeLabel = selectedCellTypes.length > 0 ? selectedCellTypes.join(", ") : "None selected";

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <div className="h3">DE volcano (gene-level, per cell type)</div>
          <div className="muted small">
            Computed from donor-level pseudobulk within the selected cell type.
          </div>
          <div className="muted small">Diseases: {diseaseLabel}</div>
          <div className="muted small">Cell types: {cellTypeLabel}</div>
        </div>
        <div className="muted small">Disease vs Healthy only (single-disease mode).</div>
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
                {item}
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
            {cellTypes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <button className="btn" disabled={loading || mode !== "single"} onClick={handleFetch}>
          {loading ? "Loading…" : "Load results"}
        </button>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      {response?.ok && response.top_up && response.top_down ? (
        <div className="panel-grid">
          <div>
            <div className="h4">Top up</div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Gene</th>
                  <th>logFC</th>
                </tr>
              </thead>
              <tbody>
                {response.top_up.map((row) => (
                  <tr key={`up-${row.gene}`}>
                    <td>{row.gene}</td>
                    <td>{row.logfc.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <div className="h4">Top down</div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Gene</th>
                  <th>logFC</th>
                </tr>
              </thead>
              <tbody>
                {response.top_down.map((row) => (
                  <tr key={`down-${row.gene}`}>
                    <td>{row.gene}</td>
                    <td>{row.logfc.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <svg className="placeholder-svg" viewBox="0 0 420 200" aria-hidden="true">
        <rect x="30" y="30" width="360" height="130" rx="12" fill="#f8fafc" stroke="#e2e8f0" />
        <line x1="210" y1="30" x2="210" y2="160" stroke="#cbd5f5" strokeWidth="2" />
        <text x="40" y="185" fill="#64748b" fontSize="12">logFC →</text>
        <text x="15" y="110" fill="#64748b" fontSize="12" transform="rotate(-90 15 110)">-log10 padj</text>
      </svg>
    </div>
  );
}
