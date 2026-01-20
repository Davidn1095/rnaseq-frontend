import { useEffect, useMemo, useRef, useState } from "react";
import type { DotplotByDiseaseResponse, Mode } from "../../lib/types";
import { DEFAULT_RESOLVED_BASE, fetchDotplotByDisease } from "../../lib/api";
import { getStoredApiBase } from "../../lib/storage";
import { ChevronDown, Search, X } from "lucide-react";

type DotPlotFacetedProps = {
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

export default function DotPlotFaceted({
  mode: _mode,
  disease: _disease,
  leftDisease: _leftDisease,
  rightDisease: _rightDisease,
  markerPanel: _markerPanel,
  markerPanels: _markerPanels,
  onMarkerPanelChange: _onMarkerPanelChange,
  genes,
  loadingGenes,
}: DotPlotFacetedProps) {
  const apiBase = getStoredApiBase() ?? DEFAULT_RESOLVED_BASE;
  const [dotplotData, setDotplotData] = useState<DotplotByDiseaseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const plotRef = useRef<HTMLDivElement | null>(null);

  // Single gene selection with searchable dropdown
  const [selectedGene, setSelectedGene] = useState<string | null>(genes[0] ?? null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (dropdownOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [dropdownOpen]);

  // Update selected gene when genes list changes
  useEffect(() => {
    if (genes.length === 0) {
      setSelectedGene(null);
      return;
    }
    setSelectedGene((prev) => {
      if (prev && genes.includes(prev)) return prev;
      return genes[0];
    });
  }, [genes]);

  // Fetch dotplot data for selected gene
  useEffect(() => {
    if (!selectedGene) return;
    let active = true;
    setError(null);
    fetchDotplotByDisease(apiBase, [selectedGene])
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
  }, [apiBase, selectedGene]);

  // Build faceted traces: one subplot per cell type, x-axis = diseases
  const { traces, layout } = useMemo(() => {
    if (!dotplotData?.diseases || !selectedGene) return { traces: [], layout: {} };

    const diseases = Object.keys(dotplotData.diseases);
    if (diseases.length === 0) return { traces: [], layout: {} };

    // Get all unique cell types across diseases
    const allCellTypes = new Set<string>();
    diseases.forEach((diseaseName) => {
      const diseaseData = dotplotData.diseases![diseaseName];
      if (diseaseData.groups) {
        diseaseData.groups.forEach((ct) => allCellTypes.add(ct));
      }
    });
    const cellTypes = Array.from(allCellTypes).sort();

    if (cellTypes.length === 0) return { traces: [], layout: {} };

    // Create grid layout: cell types as facets (rows/cols), diseases on x-axis within each facet
    const numCellTypes = cellTypes.length;
    const cols = Math.min(numCellTypes, 4);
    const rows = Math.ceil(numCellTypes / cols);

    const allTraces: Array<Record<string, unknown>> = [];
    const annotations: Array<Record<string, unknown>> = [];

    // Build a lookup for expression data: disease -> cellType -> {avg, pct}
    const dataLookup: Record<string, Record<string, { avg: number; pct: number }>> = {};
    diseases.forEach((diseaseName) => {
      dataLookup[diseaseName] = {};
      const diseaseData = dotplotData.diseases![diseaseName];
      if (!diseaseData.groups || !diseaseData.genes || !diseaseData.avg || !diseaseData.pct) return;

      // Find gene index
      const geneIdx = diseaseData.genes.indexOf(selectedGene);
      if (geneIdx === -1) return;

      diseaseData.groups.forEach((cellType, ctIdx) => {
        dataLookup[diseaseName][cellType] = {
          avg: diseaseData.avg[geneIdx][ctIdx],
          pct: diseaseData.pct[geneIdx][ctIdx],
        };
      });
    });

    // Find global min/max for consistent color scale
    let minAvg = Infinity;
    let maxAvg = -Infinity;
    Object.values(dataLookup).forEach((ctData) => {
      Object.values(ctData).forEach(({ avg }) => {
        if (avg < minAvg) minAvg = avg;
        if (avg > maxAvg) maxAvg = avg;
      });
    });

    // Create one subplot per cell type
    cellTypes.forEach((cellType, idx) => {
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      const xAxisId = idx === 0 ? "x" : `x${idx + 1}`;
      const yAxisId = idx === 0 ? "y" : `y${idx + 1}`;

      const xValues: string[] = [];
      const yValues: string[] = [];
      const avgValues: number[] = [];
      const sizeValues: number[] = [];
      const hoverText: string[] = [];

      diseases.forEach((diseaseName) => {
        const data = dataLookup[diseaseName]?.[cellType];
        if (data) {
          xValues.push(mapDiseaseLabel(diseaseName));
          yValues.push(selectedGene);
          avgValues.push(data.avg);
          sizeValues.push(6 + data.pct * 30);
          hoverText.push(
            `${mapDiseaseLabel(diseaseName)}<br>` +
            `Cell type: ${cellType}<br>` +
            `Gene: ${selectedGene}<br>` +
            `Avg expression: ${data.avg.toFixed(2)}<br>` +
            `% expressing: ${(data.pct * 100).toFixed(1)}%`
          );
        }
      });

      allTraces.push({
        type: "scatter",
        mode: "markers",
        name: cellType,
        x: xValues,
        y: yValues,
        xaxis: xAxisId,
        yaxis: yAxisId,
        marker: {
          size: sizeValues,
          color: avgValues,
          colorscale: "Blues",
          cmin: minAvg,
          cmax: maxAvg,
          showscale: idx === 0,
          colorbar: idx === 0 ? { title: "Avg", x: 1.02, len: 0.5 } : undefined,
        },
        text: hoverText,
        hoverinfo: "text",
        showlegend: false,
      });

      // Add subplot title annotation
      const xDomain = [col / cols + 0.02, (col + 1) / cols - 0.02];
      const yDomain = [1 - (row + 1) / rows + 0.02, 1 - row / rows - 0.1];

      annotations.push({
        text: `<b>${cellType}</b>`,
        x: (xDomain[0] + xDomain[1]) / 2,
        y: yDomain[1] + 0.06,
        xref: "paper",
        yref: "paper",
        showarrow: false,
        font: { size: 11 },
      });
    });

    // Build layout with subplots
    const subplotLayout: Record<string, unknown> = {
      margin: { l: 80, r: 60, t: 60, b: 80 },
      height: Math.max(400, 120 + rows * 140),
      showlegend: false,
      annotations,
      title: {
        text: `Expression of <b>${selectedGene}</b> across diseases`,
        font: { size: 14 },
        y: 0.98,
      },
    };

    cellTypes.forEach((_, idx) => {
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      const xKey = idx === 0 ? "xaxis" : `xaxis${idx + 1}`;
      const yKey = idx === 0 ? "yaxis" : `yaxis${idx + 1}`;

      const xDomain = [col / cols + 0.08, (col + 1) / cols - 0.04];
      const yDomain = [1 - (row + 1) / rows + 0.12, 1 - row / rows - 0.1];

      subplotLayout[xKey] = {
        domain: xDomain,
        anchor: idx === 0 ? "y" : `y${idx + 1}`,
        automargin: true,
        tickangle: 45,
        tickfont: { size: 9 },
      };
      subplotLayout[yKey] = {
        domain: yDomain,
        anchor: idx === 0 ? "x" : `x${idx + 1}`,
        automargin: true,
        showticklabels: false,
      };
    });

    return { traces: allTraces, layout: subplotLayout };
  }, [dotplotData, selectedGene]);

  // Render plot
  useEffect(() => {
    if (!plotRef.current || !window.Plotly || traces.length === 0) return;
    window.Plotly.react(plotRef.current, traces, layout, { displayModeBar: false, responsive: true });
  }, [traces, layout]);

  const handleSelectGene = (gene: string) => {
    setSelectedGene(gene);
    setDropdownOpen(false);
    setSearchQuery("");
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="h3">Dot plot</div>
        <div className="legend">
          <span className="muted small">Axes: cell types (facets) × diseases</span>
        </div>
      </div>
      <div className="muted small" style={{ marginTop: 4 }}>
        Dot size: % cells expressing | Color: mean expression
      </div>

      <div className="row gap top">
        <div className="field" style={{ minWidth: 280, maxWidth: 320 }} ref={dropdownRef}>
          <label className="muted small">Gene</label>
          {loadingGenes ? (
            <div className="skeleton input" />
          ) : (
            <div className="gene-dropdown-selector">
              <button
                type="button"
                className="gene-dropdown-trigger"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <span className="gene-dropdown-value">
                  {selectedGene || "Select a gene..."}
                </span>
                <ChevronDown size={16} className={`gene-dropdown-chevron ${dropdownOpen ? "open" : ""}`} />
              </button>

              {dropdownOpen && (
                <div className="gene-dropdown-panel">
                  <div className="gene-dropdown-search">
                    <Search size={14} className="gene-dropdown-search-icon" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      className="gene-dropdown-search-input"
                      placeholder="Search genes..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        className="gene-dropdown-search-clear"
                        onClick={() => setSearchQuery("")}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  <div className="gene-dropdown-list">
                    {filteredGenes.length === 0 ? (
                      <div className="gene-dropdown-empty">No genes found</div>
                    ) : (
                      filteredGenes.map((gene) => (
                        <button
                          key={gene}
                          type="button"
                          className={`gene-dropdown-option ${gene === selectedGene ? "selected" : ""}`}
                          onClick={() => handleSelectGene(gene)}
                        >
                          {gene}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="plot-frame large" ref={plotRef} style={{ height: "auto", minHeight: 520 }} />
    </div>
  );
}
