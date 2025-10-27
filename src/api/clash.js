const getBaseUrl = () =>
  localStorage.getItem("apiBaseUrl") || "http://127.0.0.1:9090";
const SECRET = "";

// 通用请求封装
async function request(path, options = {}) {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(SECRET ? { Authorization: `Bearer ${SECRET}` } : {}),
      ...options.headers,
    },
    ...options,
  });
  if (res.status === 204) return {};
  try {
    return await res.json();
  } catch {
    return {};
  }
}

// 基础 API
export const getProxies = () => request("/proxies");
export const getConfigs = () => request("/configs");
export const getTraffic = () => request("/traffic");
export const getConnections = () => request("/connections");
export const getRules = () => request("/rules");
export const getVersion = () => request("/version");

// 切换代理
export const switchProxy = (group, node) =>
  request(`/proxies/${encodeURIComponent(group)}`, {
    method: "PUT",
    body: JSON.stringify({ name: node }),
  });

// 关闭所有连接
export const closeAllConnections = () =>
  fetch(`${getBaseUrl()}/connections`, { method: "DELETE" });

// 关闭单个连接
export const closeConnection = (id) =>
  fetch(`${getBaseUrl()}/connections/${id}`, { method: "DELETE" });

// 测试单个节点延迟
export const testDelay = async (
  proxyName,
  url = "http://www.gstatic.com/generate_204",
  timeout = 5000,
  signal,
) => {
  const res = await fetch(
    `${getBaseUrl()}/proxies/${encodeURIComponent(proxyName)}/delay?url=${encodeURIComponent(
      url,
    )}&timeout=${timeout}`,
    {
      headers: {
        ...(SECRET ? { Authorization: `Bearer ${SECRET}` } : {}),
      },
      signal,
    },
  );
  return res.json();
};

// 批量测试延迟
export function testDelaysInBatch(
  nodes,
  concurrency = 5,
  onBatchUpdate,
  batchInterval = 500,
) {
  let index = 0;
  const results = {};
  const controller = new AbortController();
  let buffer = {};
  let timer;

  const flush = () => {
    if (Object.keys(buffer).length > 0) {
      onBatchUpdate?.({ ...buffer });
      buffer = {};
    }
  };
  timer = setInterval(flush, batchInterval);

  async function worker() {
    while (index < nodes.length) {
      const i = index++;
      const node = nodes[i];
      try {
        const res = await testDelay(
          node.name,
          undefined,
          undefined,
          controller.signal,
        );
        results[node.name] = res.delay ?? "N/A";
      } catch {
        results[node.name] = "N/A";
      }
      buffer[node.name] = results[node.name];
    }
  }

  const promise = Promise.all(Array.from({ length: concurrency }, worker))
    .then(() => {
      clearInterval(timer);
      flush();
      return results;
    })
    .catch((err) => {
      clearInterval(timer);
      throw err;
    });

  return { promise, abort: () => controller.abort() };
}

// WebSocket 地址构造
const wsUrl = (path) => {
  const base = getBaseUrl();
  const url = new URL(path, base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
};

// ✅ 通用订阅封装（共享连接 + 多监听）
function createWebSocketSubscription(path) {
  let ws = null;
  let state = 0;
  let frozen = false;
  const listeners = new Set();

  const broadcast = (raw) => {
    try {
      const data = JSON.parse(raw);
      listeners.forEach((fn) => fn(data));
    } catch (e) {
      console.error(`[WS] ${path} fail to connect`, e);
    }
  };

  const connect = () => {
    if (ws || state === 1) return;
    state = 1;
    ws = new WebSocket(wsUrl(path));

    ws.onopen = () => {
      console.log(`[WS] ${path} connected`);
    };

    ws.onmessage = (event) => broadcast(event.data);

    ws.onerror = (err) => {
      console.error(`[WS] ${path} error`, err);
      state = 2;
      try {
        ws.close();
      } catch {}
    };

    ws.onclose = () => {
      state = 3;
      ws = null;
      if (!frozen) {
        console.warn(`[WS] ${path} reconnected`);
        setTimeout(connect, 2000);
      }
    };

    const onFreeze = () => {
      frozen = true;
      try {
        ws?.close();
      } catch {}
    };
    const onResume = () => {
      frozen = false;
      connect();
    };

    document.addEventListener("freeze", onFreeze, { once: true });
    document.addEventListener("resume", onResume, { once: true });
  };

  connect();

  return function subscribe(handler) {
    listeners.add(handler);
    return () => listeners.delete(handler);
  };
}

// ✅ 连接订阅
export const subscribeConnections = createWebSocketSubscription("/connections");

// ✅ 日志订阅
export const subscribeLogs = createWebSocketSubscription("/logs");

// ✅ 内存订阅（带数据处理）
export const subscribeMemory = (() => {
  const subscribe = createWebSocketSubscription("/memory");
  return (onMessage) => {
    return subscribe((data) => {
      onMessage?.({
        inuse: data.inuse ?? 0,
        oslimit: data.oslimit ?? 0,
      });
    });
  };
})();
// ✅ 流量订阅（带数据处理）
export const subscribeTraffic = (() => {
  let totalUp = 0;
  let totalDown = 0;

  const subscribe = createWebSocketSubscription("/traffic");

  return (onMessage) => {
    return subscribe((data) => {
      const up = data.up ?? 0;
      const down = data.down ?? 0;

      onMessage?.({ up, down });
    });
  };
})();
