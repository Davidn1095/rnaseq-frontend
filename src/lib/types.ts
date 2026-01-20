export type Mode = "single" | "compare";

export type Accession = {
  id: string;
  disease: string;
  platform: string;
  donors: number;
  cells: number;
  tissue: string;
};

export type Manifest = {
  ok: boolean;
  tissue: string;
  diseases: string[];
  accessions: Accession[];
  cell_types: string[];
  marker_panels: Record<string, string[]>;
};

export type AccessionsResponse = {
  ok: boolean;
  accessions: Accession[];
};

export type MarkersResponse = {
  ok: boolean;
  genes: string[];
};

export type DeRow = {
  gene: string;
  logfc: number;
  p_val?: number;
  p_val_adj?: number;
  padj?: number;
};

export type DeResponse = {
  ok: boolean;
  contrast?: string;
  cell_type?: string;
  total?: number;
  limit?: number;
  offset?: number;
  rows?: DeRow[];
  top_up?: DeRow[];
  top_down?: DeRow[];
  error?: string;
  available?: string[];
};

export type ViolinSummary = {
  label: string;
  histogram?: {
    bins: number[];
    counts: number[];
  };
  quantiles?: {
    min: number;
    q1: number;
    median: number;
    q3: number;
    max: number;
  };
};
