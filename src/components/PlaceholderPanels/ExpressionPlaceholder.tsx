import { useEffect, useMemo, useRef, useState } from "react";
import type { Mode, ViolinResponse } from "../../lib/types";
import { DEFAULT_RESOLVED_BASE, fetchMarkers, fetchViolin } from "../../lib/api";
import { getStoredApiBase } from "../../lib/storage";

// Color palette for signatures/genes
const SIGNATURE_COLORS: Record<string, string> = {
  default: "#64748b",
  RA: "#dc2626",
  "Rheumatoid arthritis": "#dc2626",
  SLE: "#2563eb",
  "Systemic lupus erythematosus": "#2563eb",
  SjS: "#16a34a",
  "Sjögren syndrome": "#16a34a",
  Healthy: "#64748b",
};

const GENE_COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#ea580c",
  "#9333ea", "#0891b2", "#db2777", "#ca8a04",
];

type ExpressionPlaceholderProps = {
  mode: Mode;
  disease: string;
  leftDisease: string;
  rightDisease: string;
  genes: string[];
  markerPanels: string[];
  markerPanel: string;
  onMarkerPanelChange: (panel: string) => void;
};

export default function ExpressionPlaceholder({
  mode,
  disease,
  leftDisease,
  rightDisease,
  genes,
  markerPanels,
  markerPanel,
  onMarkerPanelChange,
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

  const mapPanelLabel = (value: string) => {
    const normalized = value.trim().toLowerCase();
    if (normalized === "default") return "Default";
    if (normalized === "ra") return "Rheumatoid arthritis";
    if (normalized === "sjs") return "Sjögren syndrome";
    if (normalized === "sle") return "Systemic lupus erythematosus";
    return value;
  };

  const [signatureData, setSignatureData] = useState<{
    panel: string;
    genes: string[];
    responses: Record<string, ViolinResponse>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const plotRef = useRef<HTMLDivElement | null>(null);

  // Load signature data when panel changes
  useEffect(() => {

    let active = true;
    setLoading(true);
    setError(null);

    fetchMarkers(apiBase, markerPanel)
      .then(async (markersRes) => {
        if (!active) return;
        if (!markersRes.ok || markersRes.genes.length === 0) {
          setError("No genes in this signature");
          setSignatureData(null);
          return;
        }

        // Fetch violin data for all genes in the signature
        const signatureGenes = markersRes.genes.slice(0, 50); // Limit to 50 genes for performance
        const violinPromises = signatureGenes.map((gene) =>
          fetchViolin(apiBase, gene, "disease", "hist")
        );

        const violinResults = await Promise.all(violinPromises);
        if (!active) return;

        const responses: Record<string, ViolinResponse> = {};
        violinResults.forEach((res, idx) => {
          if (res.ok) {
            responses[signatureGenes[idx]] = res;
          }
        });

        if (Object.keys(responses).length === 0) {
          setError("Unable to load expression data for this signature");
          setSignatureData(null);
          return;
        }

        setSignatureData({
          panel: markerPanel,
          genes: signatureGenes,
          responses,
        });
      })
      .catch((err) => {
        if (!active) return;
        setError(String((err as Error).message ?? err));
        setSignatureData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [apiBase, markerPanel]);

  // Build signature plot traces (aggregate expression score)
  const signaturePlotTraces = useMemo(() => {
    if (!signatureData || Object.keys(signatureData.responses).length === 0) return [];

    const responses = signatureData.responses;
    const geneList = Object.keys(responses);

    // Get all disease groups from the first response
    const firstRes = responses[geneList[0]];
    if (!firstRes?.ok || !firstRes.groups || !firstRes.bins || !firstRes.counts) return [];

    const diseaseGroups = firstRes.groups;
    const color = SIGNATURE_COLORS[markerPanel] || "#2563eb";

    // For each disease, aggregate expression across all signature genes
    const traces: Array<Record<string, unknown>> = [];

    diseaseGroups.forEach((disease, diseaseIdx) => {
      const allSamples: number[] = [];

      geneList.forEach((gene) => {
        const res = responses[gene];
        if (!res?.ok || !res.bins || !res.counts) return;

        const bins = res.bins;
        const midpoints = bins.slice(0, -1).map((start, idx) => (start + bins[idx + 1]) / 2);
        const counts = res.counts[diseaseIdx] ?? [];
        const total = counts.reduce((sum, val) => sum + val, 0) || 1;
        const maxSamplesPerGene = Math.floor(2000 / geneList.length);

        counts.forEach((count, binIdx) => {
          const n = Math.round((count / total) * maxSamplesPerGene);
          for (let i = 0; i < n; i += 1) {
            allSamples.push(midpoints[binIdx]);
          }
        });
      });

      traces.push({
        type: "violin",
        name: mapDiseaseLabel(disease),
        x: Array(allSamples.length).fill(mapDiseaseLabel(disease)),
        y: allSamples,
        box: { visible: true, width: 0.1 },
        meanline: { visible: true },
        points: false,
        line: { color },
        fillcolor: color,
        opacity: 0.7,
        showlegend: false,
      });
    });

    return traces;
  }, [signatureData, markerPanel]);

  // Render plot
  useEffect(() => {
    if (!plotRef.current || !window.Plotly) return;

    const traces = signaturePlotTraces;
    if (traces.length === 0) return;

    const layout = {
      margin: { l: 60, r: 20, t: 10, b: 120 },
      height: 520,
      yaxis: { title: "Signature Expression" },
      xaxis: { automargin: true, tickangle: -45 },
      violinmode: "overlay",
      violingap: 0.1,
      violingroupgap: 0.05,
    };

    window.Plotly.react(plotRef.current, traces, layout, { displayModeBar: false, responsive: true });
  }, [signaturePlotTraces]);

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <div className="h3">Violin</div>
          <div className="muted small">Disease signature expression across conditions</div>
        </div>
      </div>

      {/* Signature selector */}
      <div className="panel-controls">
        <label className="control">
          <span>Disease signature</span>
          <select
            value={markerPanel}
            onChange={(e) => onMarkerPanelChange(e.target.value)}
          >
            {markerPanels.map((panel) => (
              <option key={panel} value={panel}>
                {mapPanelLabel(panel)}
              </option>
            ))}
          </select>
        </label>
        {signatureData && (
          <div className="muted small" style={{ marginLeft: 12, alignSelf: "flex-end", paddingBottom: 8 }}>
            {signatureData.genes.length} genes in signature
          </div>
        )}
      </div>

      {loading && <div className="muted small" style={{ marginTop: 12 }}>Loading signature data...</div>}
      {error && <div className="error-banner">{error}</div>}

      <div className="plot-frame large" ref={plotRef} />
    </div>
  );
}
