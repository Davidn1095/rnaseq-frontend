import { useEffect, useMemo, useRef, useState } from "react";
import type { Mode, ViolinResponse } from "../../lib/types";
import { DEFAULT_RESOLVED_BASE, fetchViolin } from "../../lib/api";
import { getStoredApiBase } from "../../lib/storage";

// Color palette for genes
const GENE_COLORS = [
  "#2563eb", // blue
  "#dc2626", // red
  "#16a34a", // green
  "#ea580c", // orange
  "#9333ea", // purple
  "#0891b2", // cyan
  "#db2777", // pink
  "#ca8a04", // yellow
];

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
  const mapDiseaseLabel = (value: string) => {
    const normalized = value.trim().toLowerCase();
    if (normalized === "normal") return "Healthy";
    if (normalized === "ra" || normalized === "rheumatoid arthritis") return "Rheumatoid arthritis";
    if (normalized === "sjs") return "Sjögren syndrome";
    if (normalized === "sle" || normalized === "systemic lupus erythematosus") return "Systemic lupus erythematosus";
    return value;
  };

  const [selectedGenes, setSelectedGenes] = useState<string[]>(genes.slice(0, 4));
  const [responses, setResponses] = useState<Record<string, ViolinResponse>>({});
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const plotRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const filteredGenes = useMemo(() => {
    const available = genes.length > 0 ? genes : ["IL7R"];
    if (!searchQuery.trim()) return available;
    const query = searchQuery.toLowerCase();
    return available.filter((gene) => gene.toLowerCase().includes(query));
  }, [genes, searchQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


  useEffect(() => {
    if (genes.length === 0) {
      setSelectedGenes([]);
      return;
    }
    setSelectedGenes((prev) => {
      const filtered = prev.filter((gene) => genes.includes(gene));
      return filtered.length > 0 ? filtered : genes.slice(0, 4);
    });
  }, [genes]);

  useEffect(() => {
    let active = true;
    setError(null);
    const activeGenes = selectedGenes.length > 0 ? selectedGenes : ["IL7R"];
    Promise.all(activeGenes.map((gene) => fetchViolin(apiBase, gene, "disease", "hist")))
      .then((payloads) => {
        if (!active) return;
        const ok = payloads.every((res) => res.ok);
        if (!ok) {
          const firstError = payloads.find((res) => !res.ok);
          setError(firstError?.error ?? "Unable to load expression data");
          setResponses({});
          return;
        }
        const next: Record<string, ViolinResponse> = {};
        payloads.forEach((res, idx) => {
          next[activeGenes[idx]] = res;
        });
        setResponses(next);
      })
      .catch((err) => {
        if (!active) return;
        setError(String((err as Error).message ?? err));
        setResponses({});
      });
    return () => {
      active = false;
    };
  }, [apiBase, selectedGenes]);

  const plotTrace = useMemo(() => {
    const genesToPlot = selectedGenes.length > 0 ? selectedGenes : ["IL7R"];
    const traces: Array<Record<string, unknown>> = [];

    genesToPlot.forEach((gene, geneIdx) => {
      const res = responses[gene];
      if (!res?.ok || !res.groups || !res.bins || !res.counts) return;

      const bins = res.bins;
      const midpoints = bins.slice(0, -1).map((start, idx) => (start + bins[idx + 1]) / 2);
      const maxSamples = 2000;
      const color = GENE_COLORS[geneIdx % GENE_COLORS.length];

      res.groups.forEach((label, idx) => {
        const counts = res.counts?.[idx] ?? [];
        const total = counts.reduce((sum, val) => sum + val, 0) || 1;
        const samples: number[] = [];
        counts.forEach((count, binIdx) => {
          const n = Math.round((count / total) * maxSamples);
          for (let i = 0; i < n; i += 1) {
            samples.push(midpoints[binIdx]);
          }
        });

        traces.push({
          type: "violin",
          name: gene,
          legendgroup: gene,
          scalegroup: gene,
          x: Array(samples.length).fill(mapDiseaseLabel(label)),
          y: samples,
          box: { visible: false },
          meanline: { visible: true },
          points: false,
          line: { color },
          fillcolor: color,
          opacity: 0.7,
          showlegend: idx === 0,
        });
      });
    });

    return traces;
  }, [responses, selectedGenes]);

  useEffect(() => {
    if (!plotRef.current || !window.Plotly || plotTrace.length === 0) return;
    const layout = {
      margin: { l: 60, r: 20, t: 10, b: 120 },
      height: 520,
      yaxis: { title: "Expression" },
      xaxis: { automargin: true, tickangle: -45 },
      violinmode: "group",
      violingap: 0.1,
      violingroupgap: 0.05,
      legend: {
        orientation: "h" as const,
        y: 1.1,
        x: 0.5,
        xanchor: "center" as const,
      },
    };
    window.Plotly.react(plotRef.current, plotTrace, layout, { displayModeBar: false, responsive: true });
  }, [plotTrace]);

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <div className="h3">Violin</div>
          <div className="muted small">Expression distributions across diseases</div>
        </div>
      </div>

      <div className="row gap top">
        <div className="field grow" ref={dropdownRef}>
          <label className="muted small">Genes (select up to 8)</label>
          <div className="gene-select-container">
            <div className="gene-tags">
              {selectedGenes.map((gene, idx) => (
                <span
                  key={gene}
                  className="gene-tag"
                  style={{
                    backgroundColor: `${GENE_COLORS[idx % GENE_COLORS.length]}20`,
                    color: GENE_COLORS[idx % GENE_COLORS.length],
                    borderColor: GENE_COLORS[idx % GENE_COLORS.length],
                  }}
                >
                  {gene}
                  <button
                    type="button"
                    className="gene-tag-remove"
                    style={{ color: GENE_COLORS[idx % GENE_COLORS.length] }}
                    onClick={() => setSelectedGenes((prev) => prev.filter((g) => g !== gene))}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                type="text"
                className="gene-search-input"
                placeholder={selectedGenes.length === 0 ? "Search genes..." : ""}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setDropdownOpen(true)}
              />
            </div>
            {dropdownOpen && (
              <div className="gene-dropdown">
                {filteredGenes.length === 0 ? (
                  <div className="gene-dropdown-item disabled">No matches</div>
                ) : (
                  filteredGenes.map((gene) => {
                    const isSelected = selectedGenes.includes(gene);
                    const isDisabled = !isSelected && selectedGenes.length >= 8;
                    return (
                      <div
                        key={gene}
                        className={`gene-dropdown-item ${isSelected ? "selected" : ""} ${isDisabled ? "disabled" : ""}`}
                        onClick={() => {
                          if (isDisabled) return;
                          setSelectedGenes((prev) => {
                            if (isSelected) return prev.filter((g) => g !== gene);
                            return [...prev, gene];
                          });
                          setSearchQuery("");
                        }}
                      >
                        <span className="gene-checkbox">{isSelected ? "✓" : ""}</span>
                        {gene}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="plot-frame large" ref={plotRef} />
    </div>
  );
}
