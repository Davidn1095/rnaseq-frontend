import type { CompositionResponse, DeResponse, DotplotByDiseaseResponse, DotplotResponse, Manifest, MarkersResponse, UmapResponse, ViolinResponse } from "./types";

export const DEFAULT_API_BASE = "https://rnaseq-backend-y654q6wo2q-ew.a.run.app";
export const ENV_API_BASE = import.meta.env.VITE_API_BASE_URL as string | undefined;
export const DEFAULT_RESOLVED_BASE = ENV_API_BASE && ENV_API_BASE.length > 0 ? ENV_API_BASE : DEFAULT_API_BASE;

const TIMEOUT_MS = 20_000;
const RETRY_COUNT = 1;

function stripTrailingSlash(url: string) {
  return url.replace(/\/+$/, "");
}

async function fetchJson<T>(url: string, init: RequestInit = {}, retries = RETRY_COUNT): Promise<T> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return (await res.json()) as T;
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        throw error;
      }
    } finally {
      window.clearTimeout(timeoutId);
    }
    attempt += 1;
  }

  throw lastError;
}

export async function fetchManifest(apiBase: string): Promise<Manifest> {
  const url = `${stripTrailingSlash(apiBase)}/atlas/manifest`;
  return fetchJson<Manifest>(url);
}

export async function fetchMarkers(apiBase: string, panel: string): Promise<MarkersResponse> {
  const base = stripTrailingSlash(apiBase);
  const url = new URL(`${base}/atlas/markers`);
  url.searchParams.set("panel", panel);
  return fetchJson<MarkersResponse>(url.toString());
}

export async function fetchUmap(
  apiBase: string,
  disease?: string | null,
  maxPoints?: number,
  cellType?: string | null,
): Promise<UmapResponse> {
  const base = stripTrailingSlash(apiBase);
  const url = new URL(`${base}/atlas/umap`);
  if (disease) {
    url.searchParams.set("disease", disease);
  }
  if (cellType) {
    url.searchParams.set("cell_type", cellType);
  }
  if (maxPoints) {
    url.searchParams.set("max_points", String(maxPoints));
  }
  return fetchJson<UmapResponse>(url.toString());
}

export async function fetchDotplot(apiBase: string, genes: string[], groupBy = "cell_type"): Promise<DotplotResponse> {
  const base = stripTrailingSlash(apiBase);
  const url = new URL(`${base}/atlas/dotplot`);
  url.searchParams.set("genes", genes.join(","));
  url.searchParams.set("group_by", groupBy);
  return fetchJson<DotplotResponse>(url.toString());
}

export async function fetchDotplotByDisease(apiBase: string, genes: string[], groupBy = "cell_type"): Promise<DotplotByDiseaseResponse> {
  const base = stripTrailingSlash(apiBase);
  const url = new URL(`${base}/atlas/dotplot_by_disease`);
  url.searchParams.set("genes", genes.join(","));
  url.searchParams.set("group_by", groupBy);
  return fetchJson<DotplotByDiseaseResponse>(url.toString());
}

export async function fetchViolin(
  apiBase: string,
  gene: string,
  groupBy = "cell_type",
  kind: "hist" | "quantile" = "quantile",
): Promise<ViolinResponse> {
  const base = stripTrailingSlash(apiBase);
  const url = new URL(`${base}/atlas/violin`);
  url.searchParams.set("gene", gene);
  url.searchParams.set("group_by", groupBy);
  url.searchParams.set("kind", kind);
  return fetchJson<ViolinResponse>(url.toString());
}

export async function fetchComposition(apiBase: string, groupBy = "disease"): Promise<CompositionResponse> {
  const base = stripTrailingSlash(apiBase);
  const url = new URL(`${base}/atlas/composition`);
  url.searchParams.set("group_by", groupBy);
  return fetchJson<CompositionResponse>(url.toString());
}

export async function fetchDeByDisease(
  apiBase: string,
  disease: string,
  cellType: string,
  limit = 50,
  offset = 0,
  topN = 5,
): Promise<DeResponse> {
  const base = stripTrailingSlash(apiBase);
  const url = new URL(`${base}/atlas/de_by_disease`);
  url.searchParams.set("disease", disease);
  url.searchParams.set("cell_type", cellType);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("top_n", String(topN));
  return fetchJson<DeResponse>(url.toString());
}
