import { useEffect, useMemo, useRef, useState } from "react";
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
  const mapDiseaseLabel = (value: string) => {
    const normalized = value.trim().toLowerCase();
    if (normalized === "normal") return "Healthy";
    if (normalized === "ra" || normalized === "rheumatoid arthritis") return "Rheumatoid arthritis";
    if (normalized === "sjs") return "Sjögren syndrome";
    if (normalized === "sle" || normalized === "systemic lupus erythematosus") return "Systemic lupus erythematosus";
    return value;
  };

  const groupLabel = mode === "single"
    ? `Healthy, ${mapDiseaseLabel(disease)}`
    : `Healthy, ${mapDiseaseLabel(leftDisease)}, ${mapDiseaseLabel(rightDisease)}`;

  const [selectedGenes, setSelectedGenes] = useState<string[]>(genes.slice(0, 4));
  const [responses, setResponses] = useState<Record<string, ViolinResponse>>({});
  const [error, setError] = useState<string | null>(null);
  const plotRef = useRef<HTMLDivElement | null>(null);


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
    Promise.all(activeGenes.map((gene) => fetchViolin(apiBase, gene, "disease", "quantile")))
      .then((payloads) => {
        if (!active) return;
        const ok = payloads.every((res) => res.ok);
        if (!ok) {
          const firstError = payloads.find((res) => !res.ok);
          setError(firstError?.error ?? "Unable to load expression summary");
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
    return genesToPlot.flatMap((gene) => {
      const res = responses[gene];
      if (!res?.ok || !res.groups || !res.quantiles) return [];
      const quantiles = res.quantiles ?? [];
      return {
        type: "box",
        name: gene,
        x: res.groups.map((group) => mapDiseaseLabel(group)),
        q1: quantiles.map((q) => q?.q1 ?? null),
        median: quantiles.map((q) => q?.median ?? null),
        q3: quantiles.map((q) => q?.q3 ?? null),
        lowerfence: quantiles.map((q) => q?.min ?? null),
        upperfence: quantiles.map((q) => q?.max ?? null),
      };
    });
  }, [responses, selectedGenes]);

  useEffect(() => {
    if (!plotRef.current || !window.Plotly || plotTrace.length === 0) return;
    const layout = {
      margin: { l: 60, r: 20, t: 10, b: 90 },
      height: 520,
      yaxis: { title: "Expression" },
      xaxis: { automargin: true },
    };
    window.Plotly.react(plotRef.current, plotTrace, layout, { displayModeBar: false, responsive: true });
  }, [plotTrace]);

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <div className="h3">Expression</div>
          <div className="muted small">Per-cell distributions for selected gene(s).</div>
          <div className="muted small">Groups: {groupLabel}</div>
        </div>
        <div className="muted small">Genes: {selectedGenes.length > 0 ? selectedGenes.join(", ") : "IL7R"}</div>
      </div>

      <div className="row gap top">
        <div className="field grow">
          <label className="muted small">Genes (select up to 4)</label>
          <div className="scroll-box options">
            <div className="option-list">
              <div className="option-actions">
                <span className="muted small">{selectedGenes.length} selected</span>
              </div>
              {(genes.length > 0 ? genes : ["IL7R"]).map((gene) => (
                <label key={gene} className="option-row">
                  <input
                    type="checkbox"
                    checked={selectedGenes.includes(gene)}
                    onChange={() => {
                      setSelectedGenes((prev) => {
                        if (prev.includes(gene)) {
                          return prev.filter((item) => item !== gene);
                        }
                        if (prev.length >= 4) return prev;
                        return [...prev, gene];
                      });
                    }}
                  />
                  <span>{gene}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="plot-frame large" ref={plotRef} />
    </div>
  );
}
