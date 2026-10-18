// 后端连接配置（全部持久化在 localStorage）
export const API_MODES = { clash: "clash", grpc: "grpc" };

export const getBaseUrl = () =>
  localStorage.getItem("apiBaseUrl") || "http://127.0.0.1:9090";

export const getSecret = () => localStorage.getItem("apiSecret") || "";

// clash = Clash REST + WebSocket API；grpc = sing-box API (gRPC-Web)
export const getApiMode = () =>
  localStorage.getItem("apiMode") === API_MODES.grpc
    ? API_MODES.grpc
    : API_MODES.clash;

export const setApiMode = (mode) => localStorage.setItem("apiMode", mode);

export const setApiConfig = (baseUrl, secret) => {
  localStorage.setItem("apiBaseUrl", baseUrl);
  localStorage.setItem("apiSecret", secret);
};

export const clearApiConfig = () => {
  localStorage.removeItem("apiBaseUrl");
  localStorage.removeItem("apiSecret");
  localStorage.removeItem("apiMode");
  // Server-scoped traffic stats must not leak into the next backend.
  localStorage.removeItem("hostTraffic");
  localStorage.removeItem("nodeTraffic");
  window.dispatchEvent(new Event("api-config-cleared"));
};

export const authHeader = (secret) =>
  secret ? { Authorization: `Bearer ${secret}` } : {};
