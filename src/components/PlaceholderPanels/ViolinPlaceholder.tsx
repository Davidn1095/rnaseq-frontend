import { useEffect, useMemo, useRef, useState } from "react";
import type { ViolinResponse } from "../../lib/types";
import { DEFAULT_RESOLVED_BASE, fetchViolin } from "../../lib/api";
import { getStoredApiBase } from "../../lib/storage";

type ViolinPlaceholderProps = {
  genes: string[];
  groupBy?: "cell_type" | "disease";
};

export default function ViolinPlaceholder({ genes, groupBy = "disease" }: ViolinPlaceholderProps) {
  const apiBase = getStoredApiBase() ?? DEFAULT_RESOLVED_BASE;
  const [selectedGene, setSelectedGene] = useState(genes[0] ?? "IL7R");
  const [response, setResponse] = useState<ViolinResponse | null>(null);
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
    if (genes.length > 0 && !genes.includes(selectedGene)) {
      setSelectedGene(genes[0]);
    }
  }, [genes, selectedGene]);

  useEffect(() => {
    let active = true;
    setError(null);
    fetchViolin(apiBase, selectedGene, groupBy, "hist")
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
  }, [apiBase, selectedGene, groupBy]);

  const plotTrace = useMemo(() => {
    if (!response?.ok || !response.groups || !response.bins || !response.counts) return [];
    const bins = response.bins;
    const midpoints = bins.slice(0, -1).map((start, idx) => (start + bins[idx + 1]) / 2);
    const maxSamples = 2000;
    return response.groups.map((label, idx) => {
      const counts = response.counts?.[idx] ?? [];
      const total = counts.reduce((sum, val) => sum + val, 0) || 1;
      const samples: number[] = [];
      counts.forEach((count, binIdx) => {
        const n = Math.round((count / total) * maxSamples);
        for (let i = 0; i < n; i += 1) {
          samples.push(midpoints[binIdx]);
        }
      });
      return {
        type: "violin",
        name: groupBy === "disease" ? mapDiseaseLabel(label) : label,
        y: samples,
        box: { visible: false },
        meanline: { visible: false },
        points: false,
      };
    });
  }, [response, groupBy]);

  useEffect(() => {
    if (!plotRef.current || !window.Plotly || plotTrace.length === 0) return;
    const layout = {
      margin: { l: 60, r: 20, t: 10, b: 120 },
      height: 520,
      yaxis: { title: "Expression" },
      xaxis: { automargin: true, tickangle: -45 },
      violinmode: "group",
    };
    window.Plotly.react(plotRef.current, plotTrace, layout, { displayModeBar: false, responsive: true });
  }, [plotTrace]);

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <div className="h3">Violin</div>
          <div className="muted small">
            Expression distributions across {groupBy === "disease" ? "diseases" : "cell types"}.
          </div>
        </div>
      </div>

      <div className="panel-controls">
        <label className="control">
          <span>Gene</span>
          <select
            value={selectedGene}
            onChange={(event) => setSelectedGene(event.target.value)}
          >
            {(genes.length > 0 ? genes : ["IL7R"]).map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="plot-frame large" ref={plotRef} />
    </div>
  );
}
