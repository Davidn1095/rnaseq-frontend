import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import Header from "./components/Header";
import AnalysisSetup from "./components/AnalysisSetup";
import Visualization from "./components/Visualization";
import SettingsModal from "./components/SettingsModal";
import { DEFAULT_RESOLVED_BASE, fetchManifest, fetchMarkers } from "./lib/api";
import { clearStoredApiBase, getStoredApiBase, setStoredApiBase } from "./lib/storage";
import type { Manifest, Mode } from "./lib/types";

export default function App() {
  const NO_COMPARISON = "NA";
  const storedBase = getStoredApiBase();
  const [apiBase, setApiBase] = useState(storedBase ?? DEFAULT_RESOLVED_BASE);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [manifestStatus, setManifestStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [backendReachable, setBackendReachable] = useState<boolean | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("single");
  const [selectedCellTypes, setSelectedCellTypes] = useState<string[]>([]);
  const [leftDisease, setLeftDisease] = useState("");
  const [rightDisease, setRightDisease] = useState("");
  const [markerPanel, setMarkerPanel] = useState("default");
  const [markerGenes, setMarkerGenes] = useState<string[]>([]);
  const [markersLoading, setMarkersLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const isLoading = manifestStatus !== "loaded";

  const markerPanels = useMemo(() => {
    const panels = Object.keys(manifest?.marker_panels ?? {});
    return panels.length > 0 ? panels : ["default"];
  }, [manifest]);


  const loadMarkersForPanel = useCallback(
    async (panel: string) => {
      setMarkersLoading(true);
      try {
        const response = await fetchMarkers(apiBase, panel);
        if (!response.ok) {
          throw new Error("markers.ok=false");
        }
        setMarkerGenes(response.genes);
      } catch (error) {
        setErrorMessage(`Markers fetch failed for ${panel}: ${String((error as Error).message ?? error)}`);
      } finally {
        setMarkersLoading(false);
      }
    },
    [apiBase],
  );

  const loadManifest = useCallback(async () => {
    setManifestStatus("loading");
    setErrorMessage(null);
    setManifest(null);
    setMarkerGenes([]);
    try {
      const response = await fetchManifest(apiBase);
      if (!response.ok) {
        throw new Error("manifest.ok=false");
      }
      setManifest(response);
      setManifestStatus("loaded");
      setBackendReachable(true);
      setLastLoadedAt(new Date());

      if (import.meta.env.DEV) {
        console.assert(response.diseases.includes("Healthy"), "Manifest should include Healthy disease");
      }

      const nonHealthy = response.diseases.filter((item) => item !== "Healthy");
      const nextLeft = nonHealthy[0] ?? "";
      const resolvedLeft = nonHealthy.includes(leftDisease) ? leftDisease : nextLeft;
      const resolvedRight = nonHealthy.includes(rightDisease) ? rightDisease : NO_COMPARISON;

      setSelectedCellTypes(response.cell_types ?? []);
      setLeftDisease(resolvedLeft);
      setRightDisease(resolvedRight);

      const panelKeys = Object.keys(response.marker_panels ?? {});
      const defaultPanel = panelKeys.includes("default") ? "default" : panelKeys[0] ?? "default";
      setMarkerPanel(defaultPanel);
      await loadMarkersForPanel(defaultPanel);
    } catch (error) {
      setManifestStatus("error");
      setBackendReachable(false);
      setErrorMessage(`Manifest fetch failed: ${String((error as Error).message ?? error)}`);
    }
  }, [apiBase, leftDisease, rightDisease, loadMarkersForPanel]);

  useEffect(() => {
    loadManifest();
  }, [apiBase]);

  useEffect(() => {
    if (rightDisease && rightDisease !== NO_COMPARISON) {
      setMode("compare");
    } else {
      setMode("single");
    }
  }, [rightDisease]);

  const handleLeftDiseaseChange = (nextDisease: string) => {
    setLeftDisease(nextDisease);
  };

  const handleRightDiseaseChange = (nextDisease: string) => {
    setRightDisease(nextDisease);
  };

  const handleMarkerPanelChange = (panel: string) => {
    setMarkerPanel(panel);
    loadMarkersForPanel(panel);
  };

  const handleSaveApiBase = (nextBase: string) => {
    setStoredApiBase(nextBase);
    setApiBase(nextBase);
    setSettingsOpen(false);
  };

  const handleResetApiBase = () => {
    clearStoredApiBase();
    setApiBase(DEFAULT_RESOLVED_BASE);
    setSettingsOpen(false);
  };

  const lastLoadedLabel = lastLoadedAt
    ? lastLoadedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div className="page">
      <Header manifest={manifest} onReload={loadManifest} onOpenSettings={() => setSettingsOpen(true)} />

      {errorMessage ? (
        <div className="error-banner">
          <strong>Errors:</strong> {errorMessage}
        </div>
      ) : null}

      <div className="status-strip">
        <span className={`status-dot ${backendReachable ? "ok" : backendReachable === false ? "bad" : "idle"}`} />
        <span className="status-label">
          Backend {backendReachable ? "reachable" : backendReachable === false ? "unreachable" : "status unknown"}
        </span>
        <span className="status-sep" />
        <span className="muted small">Last manifest load: {lastLoadedLabel}</span>
      </div>

      <div className="grid">
        <AnalysisSetup
          manifest={manifest}
          selectedCellTypes={selectedCellTypes}
          onSelectedCellTypesChange={setSelectedCellTypes}
        />
        <Visualization
          manifest={manifest}
          isLoading={isLoading}
          mode={mode}
          disease={leftDisease}
          leftDisease={leftDisease}
          rightDisease={rightDisease}
          selectedCellTypes={selectedCellTypes}
          markerPanels={markerPanels}
          markerPanel={markerPanel}
          onMarkerPanelChange={handleMarkerPanelChange}
          markerGenes={markerGenes}
          markersLoading={markersLoading}
        />
      </div>

      <SettingsModal
        isOpen={settingsOpen}
        apiBase={apiBase}
        defaultApiBase={DEFAULT_RESOLVED_BASE}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveApiBase}
        onReset={handleResetApiBase}
      />
    </div>
  );
}
