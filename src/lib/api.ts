import type { AccessionsResponse, DeResponse, Manifest, MarkersResponse } from "./types";

export const DEFAULT_API_BASE = "https://rnaseq-backend-y654q6wo2q-ew.a.run.app";
export const ENV_API_BASE = import.meta.env.VITE_API_BASE_URL as string | undefined;
export const DEFAULT_RESOLVED_BASE = ENV_API_BASE && ENV_API_BASE.length > 0 ? ENV_API_BASE : DEFAULT_API_BASE;

const TIMEOUT_MS = 10_000;
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

export async function fetchAccessions(apiBase: string, disease: string): Promise<AccessionsResponse> {
  const base = stripTrailingSlash(apiBase);
  const url = new URL(`${base}/atlas/accessions`);
  url.searchParams.set("disease", disease);
  return fetchJson<AccessionsResponse>(url.toString());
}

export async function fetchMarkers(apiBase: string, panel: string): Promise<MarkersResponse> {
  const base = stripTrailingSlash(apiBase);
  const url = new URL(`${base}/atlas/markers`);
  url.searchParams.set("panel", panel);
  return fetchJson<MarkersResponse>(url.toString());
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
