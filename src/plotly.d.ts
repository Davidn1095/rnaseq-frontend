export {};

declare global {
  interface Window {
    Plotly?: {
      react: (root: HTMLDivElement, data: unknown[], layout: unknown, config: unknown) => void;
      Plots: {
        resize: (root: HTMLDivElement) => void;
      };
    };
  }
}
