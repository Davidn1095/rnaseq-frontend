import { useEffect, useMemo, useRef, useState } from "react";
import type { DotplotByDiseaseResponse, Mode } from "../../lib/types";
import { DEFAULT_RESOLVED_BASE, fetchDotplotByDisease } from "../../lib/api";
import { getStoredApiBase } from "../../lib/storage";

type DotPlotPlaceholderProps = {
  mode: Mode;
  disease: string;
  leftDisease: string;
  rightDisease: string;
  markerPanel: string;
  markerPanels: string[];
  onMarkerPanelChange: (panel: string) => void;
  genes: string[];
  loadingGenes: boolean;
};

export default function DotPlotPlaceholder({
  mode: _mode,
  disease: _disease,
  leftDisease: _leftDisease,
  rightDisease: _rightDisease,
  markerPanel: _markerPanel,
  markerPanels: _markerPanels,
  onMarkerPanelChange: _onMarkerPanelChange,
  genes,
  loadingGenes,
}: DotPlotPlaceholderProps) {
  const apiBase = getStoredApiBase() ?? DEFAULT_RESOLVED_BASE;
  const [dotplotData, setDotplotData] = useState<DotplotByDiseaseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const plotRef = useRef<HTMLDivElement | null>(null);
  const previewGenes = genes.slice(0, 30);
  const [selectedGenes, setSelectedGenes] = useState<string[]>(previewGenes);
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const mapDiseaseLabel = (value: string) => {
    const normalized = value.trim().toLowerCase();
    if (normalized === "normal") return "Healthy";
    if (normalized === "ra" || normalized === "rheumatoid arthritis") return "Rheumatoid arthritis";
    if (normalized === "sjs") return "Sjögren syndrome";
    if (normalized === "sle" || normalized === "systemic lupus erythematosus") return "Systemic lupus erythematosus";
    return value;
  };

  const filteredGenes = useMemo(() => {
    if (!searchQuery.trim()) return genes;
    const query = searchQuery.toLowerCase();
    return genes.filter((gene) => gene.toLowerCase().includes(query));
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
      const next = prev.filter((gene) => genes.includes(gene));
      return next.length > 0 ? next : genes.slice(0, 30);
    });
  }, [genes]);

  const activeGenes = selectedGenes.length > 0 ? selectedGenes.slice(0, 30) : previewGenes;

  useEffect(() => {
    if (activeGenes.length === 0) return;
    let active = true;
    setError(null);
    fetchDotplotByDisease(apiBase, activeGenes)
      .then((res) => {
        if (!active) return;
        if (!res.ok) {
          setError(res.error ?? "Unable to load dotplot");
          setDotplotData(null);
          return;
        }
        setDotplotData(res);
      })
      .catch((err) => {
        if (!active) return;
        setError(String((err as Error).message ?? err));
        setDotplotData(null);
      });
    return () => {
      active = false;
    };
  }, [apiBase, activeGenes]);

  const { traces, layout } = useMemo(() => {
    if (!dotplotData?.diseases) return { traces: [], layout: {} };

    const diseases = Object.keys(dotplotData.diseases);
    if (diseases.length === 0) return { traces: [], layout: {} };

    const numDiseases = diseases.length;
    const cols = Math.min(numDiseases, 3);
    const rows = Math.ceil(numDiseases / cols);

    const allTraces: Array<Record<string, unknown>> = [];
    const annotations: Array<Record<string, unknown>> = [];

    diseases.forEach((diseaseName, idx) => {
      const diseaseData = dotplotData.diseases![diseaseName];
      if (!diseaseData.groups || !diseaseData.genes || !diseaseData.avg || !diseaseData.pct) return;

      const row = Math.floor(idx / cols);
      const col = idx % cols;
      const xAxisId = idx === 0 ? "x" : `x${idx + 1}`;
      const yAxisId = idx === 0 ? "y" : `y${idx + 1}`;

      const points: Array<{ x: string; y: string; avg: number; pct: number }> = [];
      diseaseData.genes.forEach((gene, gi) => {
        diseaseData.groups.forEach((group, gi2) => {
          points.push({
            x: gene,
            y: group,
            avg: diseaseData.avg[gi][gi2],
            pct: diseaseData.pct[gi][gi2],
          });
        });
      });

      allTraces.push({
        type: "scatter",
        mode: "markers",
        name: mapDiseaseLabel(diseaseName),
        x: points.map((p) => p.x),
        y: points.map((p) => p.y),
        xaxis: xAxisId,
        yaxis: yAxisId,
        marker: {
          size: points.map((p) => 6 + p.pct * 30),
          color: points.map((p) => p.avg),
          colorscale: "Blues",
          showscale: idx === 0,
          colorbar: idx === 0 ? { title: "Avg", x: 1.02 } : undefined,
        },
        showlegend: false,
      });

      // Add subplot title annotation
      const xDomain = [col / cols + 0.02, (col + 1) / cols - 0.02];
      const yDomain = [1 - (row + 1) / rows + 0.02, 1 - row / rows - 0.08];

      annotations.push({
        text: `<b>${mapDiseaseLabel(diseaseName)}</b>`,
        x: (xDomain[0] + xDomain[1]) / 2,
        y: yDomain[1] + 0.04,
        xref: "paper",
        yref: "paper",
        showarrow: false,
        font: { size: 12 },
      });
    });

    // Build layout with subplots
    const subplotLayout: Record<string, unknown> = {
      margin: { l: 140, r: 60, t: 40, b: 80 },
      height: 400 + rows * 200,
      showlegend: false,
      annotations,
    };

    diseases.forEach((_, idx) => {
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      const xKey = idx === 0 ? "xaxis" : `xaxis${idx + 1}`;
      const yKey = idx === 0 ? "yaxis" : `yaxis${idx + 1}`;

      const xDomain = [col / cols + 0.12, (col + 1) / cols - 0.02];
      const yDomain = [1 - (row + 1) / rows + 0.1, 1 - row / rows - 0.08];

      subplotLayout[xKey] = {
        domain: xDomain,
        anchor: idx === 0 ? "y" : `y${idx + 1}`,
        automargin: true,
        tickangle: 45,
      };
      subplotLayout[yKey] = {
        domain: yDomain,
        anchor: idx === 0 ? "x" : `x${idx + 1}`,
        automargin: true,
      };
    });

    return { traces: allTraces, layout: subplotLayout };
  }, [dotplotData]);

  useEffect(() => {
    if (!plotRef.current || !window.Plotly || traces.length === 0) return;
    window.Plotly.react(plotRef.current, traces, layout, { displayModeBar: false, responsive: true });
  }, [traces, layout]);

  const handleSelectAll = () => {
    setSelectedGenes(genes.slice(0, 30));
  };

  const handleClearAll = () => {
    setSelectedGenes([]);
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="h3">Dot plot</div>
      </div>

      <div className="row gap top">
        <div className="field grow" ref={dropdownRef}>
          <label className="muted small">Genes (select up to 30)</label>
          {loadingGenes ? (
            <div className="skeleton-lines" />
          ) : (
            <div className="gene-select-container">
              <div className="gene-tags">
                {selectedGenes.map((gene) => (
                  <span key={gene} className="gene-tag">
                    {gene}
                    <button
                      type="button"
                      className="gene-tag-remove"
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
                  <div className="gene-dropdown-actions">
                    <button className="btn ghost small-button" type="button" onClick={handleSelectAll}>Select all</button>
                    <button className="btn ghost small-button" type="button" onClick={handleClearAll}>Clear</button>
                  </div>
                  {filteredGenes.length === 0 ? (
                    <div className="gene-dropdown-item disabled">No matches</div>
                  ) : (
                    filteredGenes.map((gene) => {
                      const isSelected = selectedGenes.includes(gene);
                      const isDisabled = !isSelected && selectedGenes.length >= 30;
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
          )}
        </div>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="plot-frame large" ref={plotRef} />
    </div>
  );
}
