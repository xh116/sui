import { authHeader, getBaseUrl, getSecret } from "./config";
import { testDelaysInBatch as runBatchTest } from "./batchTest";

// 通用请求封装
async function request(path, options = {}) {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(getSecret() ? { Authorization: `Bearer ${getSecret()}` } : {}),
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (res.status === 204) return {};
  try {
    return await res.json();
  } catch {
    return {};
  }
}

async function requestWithRetry(
  path,
  options = {},
  maxRetries = 5,
  delay = 2000,
) {
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const res = await request(path, options);
      // 成功 → 重置计数（这里直接 return 就相当于重置）
      return res;
    } catch (err) {
      attempt++;
      console.warn(`[HTTP] ${path} failed ${attempt}/${maxRetries}`, err);

      if (attempt > maxRetries) {
        throw new Error(`[HTTP] ${path} exceeded max retries ${maxRetries}`);
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export const getProxies = async () => {
  const data = await requestWithRetry("/proxies");
  try {
    const providers = await requestWithRetry("/providers/proxies");
    for (const provider of Object.values(providers.providers || {})) {
      for (const proxy of provider.proxies || []) {
        if (proxy?.name) data.proxies[proxy.name] = proxy;
      }
    }
  } catch {
    // Older Clash versions do not expose proxy providers.
  }
  return data;
};

export const getVersion = () => request("/version");
export const getRules = () => requestWithRetry("/rules");
// 切换代理
export const switchProxy = (group, node) =>
  request(`/proxies/${encodeURIComponent(group)}`, {
    method: "PUT",
    body: JSON.stringify({ name: node }),
  });

// 关闭所有连接
export const closeAllConnections = () =>
  fetch(`${getBaseUrl()}/connections`, { method: "DELETE" });

let providerRefreshPromise = null;

const refreshProxyProviders = async () => {
  if (!providerRefreshPromise) {
    providerRefreshPromise = requestWithRetry("/providers/proxies")
      .then((data) =>
        Promise.all(
          Object.keys(data.providers || {}).map((name) =>
            request(`/providers/proxies/${encodeURIComponent(name)}`, {
              method: "PUT",
            }),
          ),
        ),
      )
      .finally(() => {
        providerRefreshPromise = null;
      });
  }
  return providerRefreshPromise;
};

// 测试单个节点延迟
const testDelay = async (
  providerName,
  proxyName,
  url = "http://www.gstatic.com/generate_204",
  timeout = 5000,
  signal,
) => {
  try {
    if (!providerName) {
      const providers = await request("/providers/proxies");
      const match = Object.values(providers.providers || {})
        .flatMap((provider) => provider.proxies || [])
        .find((proxy) => proxy?.name === proxyName || proxy?.name?.endsWith(proxyName));
      if (match) {
        providerName = match["provider-name"];
        proxyName = match.name;
      }
    }
    const endpoint = providerName
      ? `/providers/proxies/${encodeURIComponent(providerName)}/${encodeURIComponent(proxyName)}/healthcheck`
      : `/proxies/${encodeURIComponent(proxyName)}/delay`;
    const res = await fetch(
      `${getBaseUrl()}${endpoint}?url=${encodeURIComponent(url)}&timeout=${timeout}`,
      {
        headers: {
          ...(getSecret() ? { Authorization: `Bearer ${getSecret()}` } : {}),
        },
        signal,
      },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Number.isFinite(Number(data?.delay))) {
      throw new Error("Clash API returned no delay");
    }
    return { delay: Number(data.delay) };
  } catch (error) {
    if (signal?.aborted) throw error;
    await refreshProxyProviders();
    await new Promise((resolve) => setTimeout(resolve, 300));
    const providers = await requestWithRetry("/providers/proxies", {}, 1, 300);
    const proxy = Object.values(providers.providers || {})
      .flatMap((provider) => provider.proxies || [])
      .find((item) => item?.name === proxyName);
    const delay = proxy?.history?.at(-1)?.delay;
    if (Number.isFinite(Number(delay)) && Number(delay) > 0) {
      return { delay: Number(delay) };
    }
    throw error;
  }

};
// 批量测试延迟
export const testDelaysInBatch = (
  nodes,
  concurrency,
  onBatchUpdate,
  batchInterval,
) =>
  runBatchTest(
    nodes,
    (node, signal) =>
      testDelay(node["provider-name"], node.name, undefined, undefined, signal),
    concurrency,
    onBatchUpdate,
    batchInterval,
  );

// 连接探测：返回 { mode, version }
export async function probe(baseUrl, secret) {
  const res = await fetch(`${baseUrl}/version`, {
    headers: authHeader(secret),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.version) throw new Error("unexpected /version response");
  return { mode: "clash", version: data.version };
}

// WebSocket 地址构造（secret 可选）
const wsUrl = (path) => {
  const base = getBaseUrl();
  const url = new URL(path, base);

  // 协议转换
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";

  const secret = getSecret();
  // 只有 secret 非空时才加参数
  if (secret && secret.trim() !== "") {
    url.searchParams.set("secret", secret);
  }

  return url.toString();
};

// ✅ 通用订阅封装（共享连接 + 多监听）
function createWebSocketSubscription(path, maxRetries = 5) {
  let ws = null;
  let state = 0;
  let frozen = false;
  let retryCount = 0;
  const listeners = new Set();
  let retryTimer = null;
  let freezeHandler = null;
  let resumeHandler = null;

  const removeLifecycleListeners = () => {
    if (freezeHandler) document.removeEventListener("freeze", freezeHandler);
    if (resumeHandler) document.removeEventListener("resume", resumeHandler);
    freezeHandler = null;
    resumeHandler = null;
  };
  const broadcast = (raw) => {
    try {
      const data = JSON.parse(raw);
      listeners.forEach((fn) => fn(data));
    } catch (e) {
      console.error(`[WS] ${path} failed to parse`, e);
    }
  };

  const connect = () => {
    // 没有订阅者时不建连接（也避免 disconnect 之后残留的重试定时器重连）
    if (listeners.size === 0) return;
    if (ws || state === 1 || retryCount >= maxRetries) {
      if (retryCount >= maxRetries) {
        console.error(`[WS] ${path} failed after ${maxRetries} retries`);
      }
      return;
    }

    state = 1;
    ws = new WebSocket(wsUrl(path));

    ws.onopen = () => {
      console.log(`[WS] ${path} connected`);
      retryCount = 0; // reset on success
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
      removeLifecycleListeners();
      if (!frozen && listeners.size > 0) {
        retryCount++;
        console.warn(`[WS] ${path} retry ${retryCount}/${maxRetries}`);
        retryTimer = setTimeout(connect, 2000);
      }
    };

    freezeHandler = () => {
      frozen = true;
      try {
        ws?.close();
      } catch {}
    };
    resumeHandler = () => {
      frozen = false;
      if (listeners.size > 0) connect();
    };

    document.addEventListener("freeze", freezeHandler, { once: true });
    document.addEventListener("resume", resumeHandler, { once: true });
  };

  const disconnect = () => {
    clearTimeout(retryTimer);
    retryTimer = null;
    removeLifecycleListeners();
    retryCount = 0;
    state = 0;
    const socket = ws;
    ws = null;
    try {
      socket?.close();
    } catch {}
  };

  return function subscribe(handler) {
    listeners.add(handler);
    // 惰性连接：有订阅者才建连接，未使用的后端不开 WebSocket
    if (listeners.size === 1) connect();
    return () => {
      listeners.delete(handler);
      if (listeners.size === 0) disconnect();
    };
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
      });
    });
  };
})();
// ✅ 流量订阅（带数据处理）
export const subscribeTraffic = (() => {
  const subscribe = createWebSocketSubscription("/traffic");

  return (onMessage) => {
    return subscribe((data) => {
      const up = data.up ?? 0;
      const down = data.down ?? 0;

      onMessage?.({ up, down });
    });
  };
})();
