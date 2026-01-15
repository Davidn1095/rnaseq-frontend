const API_BASE_KEY = "atlas_api_base";

export function getStoredApiBase(): string | null {
  try {
    return window.localStorage.getItem(API_BASE_KEY);
  } catch {
    return null;
  }
}

export function setStoredApiBase(value: string) {
  try {
    window.localStorage.setItem(API_BASE_KEY, value);
  } catch {
    // ignore write failures
  }
}

export function clearStoredApiBase() {
  try {
    window.localStorage.removeItem(API_BASE_KEY);
  } catch {
    // ignore remove failures
  }
}
