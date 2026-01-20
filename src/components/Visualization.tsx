import { useEffect, useMemo, useState } from "react";
import type { Manifest, Mode } from "../lib/types";
import CompositionPlaceholder from "./PlaceholderPanels/CompositionPlaceholder";
import VolcanoPlaceholder from "./PlaceholderPanels/VolcanoPlaceholder";
import OverlapPlaceholder from "./PlaceholderPanels/OverlapPlaceholder";
import ExpressionPlaceholder from "./PlaceholderPanels/ExpressionPlaceholder";
import ConcordancePlaceholder from "./PlaceholderPanels/ConcordancePlaceholder";
import ErrorBoundary from "./ErrorBoundary";

type VisualizationProps = {
  manifest: Manifest | null;
  isLoading: boolean;
  mode: Mode;
  disease: string;
  leftDisease: string;
  rightDisease: string;
  selectedCellTypes: string[];
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
  disease,
  leftDisease,
  rightDisease,
  selectedCellTypes,
  markerPanels,
  markerPanel,
  onMarkerPanelChange,
  markerGenes,
  markersLoading,
}: VisualizationProps) {
  const [tab, setTab] = useState<
    "composition" | "violin" | "volcano" | "overlap" | "concordance"
  >("composition");

  useEffect(() => {
    if (mode === "single" && (tab === "overlap" || tab === "concordance")) {
      setTab("composition");
    }
  }, [mode, tab]);

  const tabLabels = useMemo(() => {
    const base = [
      { id: "composition", label: "Composition" },
      { id: "violin", label: "Violin" },
      { id: "volcano", label: "Volcano" },
    ];
    if (mode === "compare") {
      base.push({ id: "concordance", label: "Concordance" }, { id: "overlap", label: "Overlap" });
    }
    return base;
  }, [mode]);

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
          {tab === "composition" ? (
            <CompositionPlaceholder />
          ) : null}

          {tab === "violin" ? (
            markerGenes.length === 0 || !disease || (mode === "compare" && (!leftDisease || !rightDisease)) ? (
              <div className="panel">
                <div className="h3">Violin</div>
                <div className="muted small">Select genes to view expression distributions</div>
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
