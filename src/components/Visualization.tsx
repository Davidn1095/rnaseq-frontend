import { useEffect, useMemo, useState } from "react";
import type { Manifest, Mode } from "../lib/types";
import UMAPPlaceholder from "./PlaceholderPanels/UMAPPlaceholder";
import DotPlotPlaceholder from "./PlaceholderPanels/DotPlotPlaceholder";
import CompositionPlaceholder from "./PlaceholderPanels/CompositionPlaceholder";
import VolcanoPlaceholder from "./PlaceholderPanels/VolcanoPlaceholder";
import OverlapPlaceholder from "./PlaceholderPanels/OverlapPlaceholder";
import ViolinPlaceholder from "./PlaceholderPanels/ViolinPlaceholder";
import ExpressionPlaceholder from "./PlaceholderPanels/ExpressionPlaceholder";
import ConcordancePlaceholder from "./PlaceholderPanels/ConcordancePlaceholder";
import ErrorBoundary from "./ErrorBoundary";

type VisualizationProps = {
  manifest: Manifest | null;
  isLoading: boolean;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  disease: string;
  leftDisease: string;
  rightDisease: string;
  selectedCellTypes: string[];
  selectedAccessionCount: number;
  markerPanels: string[];
  markerPanel: string;
  onMarkerPanelChange: (panel: string) => void;
  markerGenes: string[];
  markersLoading: boolean;
};

export default function Visualization({
  manifest,
  isLoading,
  mode,
  onModeChange,
  disease,
  leftDisease,
  rightDisease,
  selectedCellTypes,
  selectedAccessionCount,
  markerPanels,
  markerPanel,
  onMarkerPanelChange,
  markerGenes,
  markersLoading,
}: VisualizationProps) {
  const [tab, setTab] = useState<
    "umap" | "expression" | "dot" | "composition" | "volcano" | "overlap" | "violin" | "concordance"
  >("umap");
  const [groupBy, setGroupBy] = useState<"disease" | "accession">("disease");

  useEffect(() => {
    if (mode === "single" && (tab === "overlap" || tab === "concordance")) {
      setTab("umap");
    }
  }, [mode, tab]);

  const tabLabels = useMemo(() => {
    const base = [
      { id: "umap", label: "UMAP" },
      { id: "expression", label: "Expression" },
      { id: "dot", label: "Dot plot" },
      { id: "composition", label: "Composition" },
      { id: "violin", label: "Violin" },
      { id: "volcano", label: "Volcano" },
    ];
    if (mode === "compare") {
      base.push({ id: "concordance", label: "Concordance" }, { id: "overlap", label: "Overlap" });
    }
    return base;
  }, [mode]);

  const violinSummaries = useMemo(() => {
    if (mode === "single") {
      return [
        {
          label: "Healthy",
          quantiles: { min: 0.2, q1: 0.6, median: 1.1, q3: 1.8, max: 2.6 },
        },
        {
          label: disease,
          quantiles: { min: 0.1, q1: 0.8, median: 1.4, q3: 2.1, max: 3.0 },
        },
      ];
    }
    return [
      {
        label: leftDisease,
        quantiles: { min: 0.3, q1: 0.9, median: 1.5, q3: 2.2, max: 3.3 },
      },
      {
        label: rightDisease,
        quantiles: { min: 0.2, q1: 0.7, median: 1.2, q3: 1.9, max: 2.8 },
      },
    ];
  }, [mode, disease, leftDisease, rightDisease]);

  if (!manifest || isLoading) {
    return (
      <section className="col">
        <div className="card">
          <div className="row between">
            <div className="h2">Visualization</div>
          </div>
          <div className="skeleton panel" />
        </div>
      </section>
    );
  }

  return (
    <section className="col">
      <div className="card">
        <div className="row between">
          <div className="h2">Visualization</div>
          <span className="pill">{tab}</span>
        </div>

        <div className="tabs">
          <button
            className={`tab ${mode === "single" ? "on" : ""}`}
            onClick={() => onModeChange("single")}
          >
            Single disease
          </button>
          <button
            className={`tab ${mode === "compare" ? "on" : ""}`}
            onClick={() => onModeChange("compare")}
          >
            Comparison
          </button>
        </div>

        <div className="tabs">
          {tabLabels.map((item) => (
            <button
              key={item.id}
              className={`tab ${tab === item.id ? "on" : ""}`}
              onClick={() => setTab(item.id as typeof tab)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <ErrorBoundary fallbackTitle="Visualization error" fallbackMessage="Unable to render this panel.">
          {tab === "umap" ? (
            <UMAPPlaceholder
              mode={mode}
              selectedCellTypes={selectedCellTypes}
              selectedAccessionCount={selectedAccessionCount}
              disease={disease}
              leftDisease={leftDisease}
              rightDisease={rightDisease}
            />
          ) : null}

          {tab === "dot" ? (
            <DotPlotPlaceholder
              mode={mode}
              disease={disease}
              leftDisease={leftDisease}
              rightDisease={rightDisease}
              markerPanel={markerPanel}
              markerPanels={markerPanels}
              onMarkerPanelChange={onMarkerPanelChange}
              genes={markerGenes}
              loadingGenes={markersLoading}
            />
          ) : null}

          {tab === "expression" ? (
            markerGenes.length === 0 || !disease || (mode === "compare" && (!leftDisease || !rightDisease)) ? (
              <div className="panel">
                <div className="h3">Expression</div>
                <div className="muted small">Expression: not computed yet</div>
              </div>
            ) : (
              <ExpressionPlaceholder
                mode={mode}
                disease={disease}
                leftDisease={leftDisease}
                rightDisease={rightDisease}
                genes={markerGenes}
              />
            )
          ) : null}

          {tab === "composition" ? (
            <CompositionPlaceholder groupBy={groupBy} onGroupByChange={setGroupBy} />
          ) : null}

          {tab === "violin" ? (
            <ViolinPlaceholder summaries={violinSummaries} />
          ) : null}

          {tab === "volcano" ? (
            <VolcanoPlaceholder
              manifest={manifest}
              mode={mode}
              disease={disease}
              leftDisease={leftDisease}
              rightDisease={rightDisease}
              selectedCellTypes={selectedCellTypes}
            />
          ) : null}

          {tab === "concordance" && mode === "compare" ? (
            <ConcordancePlaceholder
              mode={mode}
              leftDisease={leftDisease}
              rightDisease={rightDisease}
            />
          ) : null}

          {tab === "overlap" && mode === "compare" ? (
            <OverlapPlaceholder leftDisease={leftDisease} rightDisease={rightDisease} />
          ) : null}
        </ErrorBoundary>
      </div>
    </section>
  );
}
