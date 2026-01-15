import { useEffect, useMemo, useState } from "react";
import type { Manifest, Mode } from "../lib/types";
import UMAPPlaceholder from "./PlaceholderPanels/UMAPPlaceholder";
import DotPlotPlaceholder from "./PlaceholderPanels/DotPlotPlaceholder";
import CompositionPlaceholder from "./PlaceholderPanels/CompositionPlaceholder";
import VolcanoPlaceholder from "./PlaceholderPanels/VolcanoPlaceholder";
import OverlapPlaceholder from "./PlaceholderPanels/OverlapPlaceholder";

type VisualizationProps = {
  manifest: Manifest | null;
  isLoading: boolean;
  mode: Mode;
  disease: string;
  leftDisease: string;
  rightDisease: string;
  cellType: string;
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
  disease,
  leftDisease,
  rightDisease,
  cellType,
  selectedAccessionCount,
  markerPanels,
  markerPanel,
  onMarkerPanelChange,
  markerGenes,
  markersLoading,
}: VisualizationProps) {
  const [tab, setTab] = useState<"umap" | "dot" | "composition" | "volcano" | "overlap">("umap");
  const [contrast, setContrast] = useState<"left" | "right">("left");
  const [groupBy, setGroupBy] = useState<"disease" | "accession">("disease");

  useEffect(() => {
    if (mode === "single" && tab === "overlap") {
      setTab("umap");
    }
  }, [mode, tab]);

  useEffect(() => {
    setContrast("left");
  }, [leftDisease, rightDisease, mode]);

  const tabLabels = useMemo(() => {
    const base = [
      { id: "umap", label: "UMAP" },
      { id: "dot", label: "Dot plot" },
      { id: "composition", label: "Composition" },
      { id: "volcano", label: "Volcano" },
    ];
    if (mode === "compare") {
      base.push({ id: "overlap", label: "Overlap" });
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

        {tab === "umap" ? (
          <UMAPPlaceholder
            mode={mode}
            cellType={cellType}
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
            contrast={contrast}
            markerPanel={markerPanel}
            markerPanels={markerPanels}
            onMarkerPanelChange={onMarkerPanelChange}
            onContrastChange={setContrast}
            genes={markerGenes}
            loadingGenes={markersLoading}
          />
        ) : null}

        {tab === "composition" ? (
          <CompositionPlaceholder groupBy={groupBy} onGroupByChange={setGroupBy} />
        ) : null}

        {tab === "volcano" ? (
          <VolcanoPlaceholder
            mode={mode}
            disease={disease}
            leftDisease={leftDisease}
            rightDisease={rightDisease}
            contrast={contrast}
            cellType={cellType}
          />
        ) : null}

        {tab === "overlap" && mode === "compare" ? (
          <OverlapPlaceholder leftDisease={leftDisease} rightDisease={rightDisease} />
        ) : null}
      </div>
    </section>
  );
}
