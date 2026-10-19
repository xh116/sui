// 后端分发：Clash REST/WebSocket 与 sing-box API（gRPC-Web）对组件暴露同一套接口
import * as clashApi from "./clash";
import * as grpcApi from "./singbox";
import { API_MODES, getApiMode } from "./config";

export {
  API_MODES,
  clearApiConfig,
  getApiMode,
  setApiConfig,
  setApiMode,
} from "./config";

const backend = () => (getApiMode() === API_MODES.grpc ? grpcApi : clashApi);

export const getProxies = (...args) => backend().getProxies(...args);
export const getRules = (...args) => backend().getRules(...args);
export const getVersion = (...args) => backend().getVersion(...args);
export const switchProxy = (...args) => backend().switchProxy(...args);
export const closeAllConnections = (...args) =>
  backend().closeAllConnections(...args);
export const testDelaysInBatch = (...args) =>
  backend().testDelaysInBatch(...args);

// sing-box-only endpoints: Clash has no equivalent.
export const getStartedAt = (...args) =>
  getApiMode() === API_MODES.grpc
    ? grpcApi.getStartedAt(...args)
    : Promise.resolve(null);
export const clearLogs = (...args) =>
  getApiMode() === API_MODES.grpc
    ? grpcApi.clearLogs(...args)
    : Promise.resolve();

export const subscribeConnections = (...args) =>
  backend().subscribeConnections(...args);
export const subscribeLogs = (...args) => backend().subscribeLogs(...args);
export const subscribeMemory = (...args) => backend().subscribeMemory(...args);
export const subscribeTraffic = (...args) =>
  backend().subscribeTraffic(...args);
export const subscribeProxyUpdates = (...args) =>
  backend().subscribeProxyUpdates(...args);

// 探测后端类型：优先 sing-box API（1.14+），失败再试 Clash API
export async function detectApi(baseUrl, secret) {
  let grpcError;
  try {
    return await grpcApi.probe(baseUrl, secret);
  } catch (err) {
    grpcError = err;
  }
  try {
    return await clashApi.probe(baseUrl, secret);
  } catch (err) {
    const grpcMessage = grpcError?.message ?? "unknown error";
    const clashMessage = err?.message ?? "unknown error";
    throw new Error(
      grpcMessage === clashMessage
        ? `${grpcMessage} (tried sing-box API and Clash API)`
        : `sing-box API: ${grpcMessage}; Clash API: ${clashMessage}`,
    );
  }
}
