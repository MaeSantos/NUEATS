import { Capacitor } from "@capacitor/core";

/**
 * CONNECTIVITY SETTINGS
 *
 * 1. LOCAL_BACKEND_URL: Used when running in a web browser on your laptop.
 * 2. ANDROID_BACKEND_URL: Fallback for Android/iOS if no public URL is set.
 * 3. PUBLIC_BACKEND_URL: Used for remote testing (ngrok).
 *    If this is set, the app will ALWAYS use this URL.
 */
const LOCAL_BACKEND_URL = "http://localhost:4000";
const ANDROID_BACKEND_URL = import.meta.env.VITE_ANDROID_BACKEND_URL || "http://10.0.2.2:4000";
const LAN_BACKEND_URL = import.meta.env.VITE_LAN_BACKEND_URL || "http://192.168.1.6:4000";
const DEFAULT_PUBLIC_BACKEND_URL = "https://manual-residency-volley.ngrok-free.dev";
const PUBLIC_BACKEND_URL = import.meta.env.VITE_PUBLIC_BACKEND_URL || "";

const apiCandidates = (() => {
  // If a Public/ngrok URL is provided, it takes absolute priority
  if (PUBLIC_BACKEND_URL && PUBLIC_BACKEND_URL.startsWith("http")) {
    return [PUBLIC_BACKEND_URL];
  }

  if (typeof window === "undefined") {
    return [LOCAL_BACKEND_URL];
  }

  const platform = Capacitor.getPlatform ? Capacitor.getPlatform() : "web";

  // If running on a mobile device (Android/iOS)
  if (platform === "android" || platform === "ios" || window.location.protocol === "capacitor:") {
    return [...new Set([DEFAULT_PUBLIC_BACKEND_URL, ANDROID_BACKEND_URL, LAN_BACKEND_URL])];
  }

  if (window.location.hostname.endsWith(".ngrok-free.dev")) {
    return [window.location.origin];
  }

  // If running in a browser but accessed via IP (e.g. from another laptop)
  if (!["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    return [`http://${window.location.hostname}:4000`];
  }

  // Default to localhost for local web development
  return [LOCAL_BACKEND_URL];
})();

let preferredApiUrl = apiCandidates[0];

console.log("NUEats Connectivity: API candidates ->", apiCandidates);

export function apiUrl(path) {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  return `${preferredApiUrl}${path}`;
}

export function apiHeaders(headers = {}) {
  return {
    "ngrok-skip-browser-warning": "true",
    ...headers,
  };
}

export function apiFetch(path, options = {}) {
  const { headers, timeoutMs = 20000, retries, ...rest } = options;
  const method = String(rest.method || "GET").toUpperCase();
  const maxRetries = retries ?? (method === "GET" ? 1 : 0);

  async function attemptFetch(baseUrl) {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeout = controller
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;

    try {
      const normalizedPath = path.startsWith("/") ? path : `/${path}`;
      return await fetch(`${baseUrl}${normalizedPath}`, {
        ...rest,
        signal: controller?.signal,
        headers: apiHeaders(headers),
      });
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  return (async () => {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      for (const candidate of apiCandidates) {
        try {
          const response = await attemptFetch(candidate);
          preferredApiUrl = candidate;
          return response;
        } catch (error) {
          lastError = error;
        }
      }
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
      }
    }
    throw lastError;
  })();
}
