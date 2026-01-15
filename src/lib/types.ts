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
