// sing-box API（since 1.14.0）适配层：gRPC-Web 传输，输出与 clash.js 相同的形状，
// 组件无需感知后端差异。proto 见 proto/daemon/started_service.proto。
import { createClient } from "@connectrpc/connect";
import { createGrpcWebTransport } from "@connectrpc/connect-web";
import {
  ConnectionEventType,
  LogLevel,
  StartedService,
} from "../gen/daemon/started_service_pb.js";
import { testDelaysInBatch as runBatchTest } from "./batchTest";
import { authHeader, getBaseUrl, getSecret } from "./config";

const MAX_RETRIES = 5;
const RETRY_DELAY = 2000;
// 合并推送：服务端 1s 一帧，多流叠加时避免每次事件都渲染
const FLUSH_INTERVAL = 250;
const URL_TEST_TIMEOUT = 10000;
const SNAPSHOT_TIMEOUT = 10000;
// interval 为 time.Duration（纳秒），<= 0 时服务端按 1s 处理
const DEFAULT_INTERVAL = 0n;

// ---------------------------------------------------------------- 客户端

function createGrpcClient(baseUrl, secret) {
  const transport = createGrpcWebTransport({
    baseUrl,
    interceptors: [
      (next) => async (req) => {
        if (secret) req.header.set("Authorization", `Bearer ${secret}`);
        return next(req);
      },
    ],
  });
  return createClient(StartedService, transport);
}

let cachedClient = null;
let cachedKey = "";

function client() {
  const baseUrl = getBaseUrl();
  const secret = getSecret();
  const key = `${baseUrl}|${secret}`;
  if (key !== cachedKey) {
    cachedClient = createGrpcClient(baseUrl, secret);
    cachedKey = key;
  }
  return cachedClient;
}

// 连接探测：返回 { mode, version }
export async function probe(baseUrl, secret) {
  const probeClient = createGrpcClient(baseUrl, secret);
  const version = await probeClient.getVersion(
    {},
    { signal: AbortSignal.timeout(4000) },
  );
  if (!version.apiVersion) throw new Error("sing-box API not available");
  return {
    mode: "grpc",
    version: `sing-box ${version.version}`,
    apiVersion: version.apiVersion,
  };
}

// ------------------------------------------------- 服务端流（引用计数 + 重连）

function createStream(path, open) {
  const listeners = new Set();
  let controller = null;
  let retryCount = 0;
  let retryTimer = null;

  const broadcast = (value) => {
    for (const fn of [...listeners]) fn(value);
  };

  const start = () => {
    if (controller || listeners.size === 0) return;
    const ac = new AbortController();
    controller = ac;
    (async () => {
      try {
        for await (const value of open(ac.signal)) {
          retryCount = 0;
          broadcast(value);
        }
      } catch (err) {
        if (!ac.signal.aborted) {
          console.error(`[gRPC] ${path} stream: ${err?.message ?? err}`);
        }
      }
      if (controller === ac) controller = null;
      if (!ac.signal.aborted && listeners.size > 0 && retryCount < MAX_RETRIES) {
        retryCount++;
        console.warn(`[gRPC] ${path} retry ${retryCount}/${MAX_RETRIES}`);
        retryTimer = setTimeout(start, RETRY_DELAY);
      } else if (retryCount >= MAX_RETRIES) {
        console.error(`[gRPC] ${path} failed after ${MAX_RETRIES} retries`);
      }
    })();
  };

  const stop = () => {
    clearTimeout(retryTimer);
    retryTimer = null;
    retryCount = 0;
    const ac = controller;
    controller = null;
    ac?.abort();
  };

  return {
    subscribe(handler) {
      listeners.add(handler);
      if (listeners.size === 1) start();
      return () => {
        listeners.delete(handler);
        if (listeners.size === 0) stop();
      };
    },
  };
}

const statusStream = createStream("/status", (signal) =>
  client().subscribeStatus({ interval: DEFAULT_INTERVAL }, { signal }),
);
const connectionsStream = createStream("/connections", (signal) =>
  client().subscribeConnections({ interval: DEFAULT_INTERVAL }, { signal }),
);
const logsStream = createStream("/logs", (signal) =>
  client().subscribeLog({}, { signal }),
);
const groupsStream = createStream("/groups", (signal) =>
  client().subscribeGroups({}, { signal }),
);


// ---------------------------------------------------------------- 工具

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function splitHostPort(value) {
  const text = String(value ?? "");
  const index = text.lastIndexOf(":");
  if (index === -1) return [text, ""];
  return [text.slice(0, index).replace(/^\[|\]$/g, ""), text.slice(index + 1)];
}

const pad = (value) => String(value).padStart(2, "0");

// LogViewer 依赖 [YY-MM-DD HH:MM:SS] [LEVEL] message 格式（gRPC 日志无时间戳）
function localTimestamp(date = new Date()) {
  return `${pad(date.getFullYear() % 100)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function toNumber(value) {
  return Number(value ?? 0);
}

// ------------------------------------------------------------ 状态 / 流量

export const subscribeMemory = (onMessage) =>
  statusStream.subscribe((status) =>
    onMessage?.({ inuse: toNumber(status.memory) }),
  );

export const subscribeTraffic = (onMessage) =>
  statusStream.subscribe((status) =>
    onMessage?.({
      up: toNumber(status.uplink),
      down: toNumber(status.downlink),
    }),
  );

// ---------------------------------------------------------------- 连接

const connectionListeners = new Set();
const connectionState = {
  map: new Map(), // id -> Clash 形状连接对象
  uploadTotal: 0,
  downloadTotal: 0,
  flushTimer: null,
  unsubscribe: [],
};
// 服务端会把已关闭的连接以 NEW + closedAt 下发：只保留一帧，
// 之后从快照移除，前端据「上一帧有、这一帧没有」归入 Closed 列表
const serverClosedIds = new Set();

function toClashConnection(connection) {
  const [sourceIP, sourcePort] = splitHostPort(connection.source);
  const [destinationIP, destinationPort] = splitHostPort(connection.destination);
  return {
    id: connection.id,
    // Clash 的 upload/download 是累计值，这里从累计字段起步，再用事件增量累加
    upload: toNumber(connection.uplinkTotal),
    download: toNumber(connection.downlinkTotal),
    start: connection.createdAt
      ? new Date(Number(connection.createdAt)).toISOString()
      : undefined,
    // chainList 已是「节点在前、策略组在后」，与 Clash 的 chains 顺序一致
    chains: connection.chainList ?? [],
    rule: connection.rule || "",
    rulePayload: "",
    metadata: {
      network: (connection.network || "").toUpperCase(),
      type: connection.protocol || connection.inboundType || "",
      host: connection.domain || "",
      sourceIP,
      sourcePort,
      destinationIP,
      destinationPort,
    },
  };
}

function connectionSnapshot() {
  return {
    connections: [...connectionState.map.values()],
    uploadTotal: connectionState.uploadTotal,
    downloadTotal: connectionState.downloadTotal,
  };
}

function scheduleConnectionsFlush() {
  if (connectionState.flushTimer) return;
  connectionState.flushTimer = setTimeout(() => {
    connectionState.flushTimer = null;
    const snapshot = connectionSnapshot();
    for (const fn of [...connectionListeners]) fn(snapshot);
    for (const id of serverClosedIds) connectionState.map.delete(id);
    serverClosedIds.clear();
  }, FLUSH_INTERVAL);
}

function applyConnectionEvents(message) {
  if (message.reset) {
    connectionState.map.clear();
    serverClosedIds.clear();
  }
  for (const event of message.events ?? []) {
    if (event.type === ConnectionEventType.CONNECTION_EVENT_CLOSED) {
      connectionState.map.delete(event.id);
      serverClosedIds.delete(event.id);
      continue;
    }
    if (
      event.type === ConnectionEventType.CONNECTION_EVENT_NEW &&
      event.connection
    ) {
      connectionState.map.set(event.id, toClashConnection(event.connection));
      if (event.connection.closedAt) serverClosedIds.add(event.id);
      else serverClosedIds.delete(event.id);
      continue;
    }
    // UPDATE 只带增量，累加到已有快照上
    const entry = connectionState.map.get(event.id);
    if (entry) {
      entry.upload += toNumber(event.uplinkDelta);
      entry.download += toNumber(event.downlinkDelta);
    }
  }
  scheduleConnectionsFlush();
}

function startConnectionsPipeline() {
  if (connectionState.unsubscribe.length > 0) return;
  connectionState.unsubscribe = [
    connectionsStream.subscribe(applyConnectionEvents),
    statusStream.subscribe((status) => {
      connectionState.uploadTotal = toNumber(status.uplinkTotal);
      connectionState.downloadTotal = toNumber(status.downlinkTotal);
      scheduleConnectionsFlush();
    }),
  ];
}

function stopConnectionsPipeline() {
  connectionState.unsubscribe.forEach((unsubscribe) => unsubscribe());
  connectionState.unsubscribe = [];
}

export function subscribeConnections(onMessage) {
  if (connectionListeners.size === 0) startConnectionsPipeline();
  connectionListeners.add(onMessage);
  onMessage?.(connectionSnapshot());
  return () => {
    connectionListeners.delete(onMessage);
    if (connectionListeners.size === 0) stopConnectionsPipeline();
  };
}

export async function closeAllConnections() {
  await client().closeAllConnections({});
}

// ---------------------------------------------------------------- 日志

export function subscribeLogs(onMessage) {
  return logsStream.subscribe((log) => {
    for (const entry of log.messages ?? []) {
      onMessage?.({
        payload: `[${localTimestamp()}] [${LogLevel[entry.level] ?? "INFO"}] ${entry.message}`,
      });
    }
  });
}

// ------------------------------------------------------------ 策略组 / 节点

let latestGroups = [];
let groupsReceived = false;
let groupsUnsubscribe = null;
let groupsKey = "";
const groupsWaiters = new Set();

function ensureGroups() {
  if (groupsUnsubscribe) return;
  groupsUnsubscribe = groupsStream.subscribe((message) => {
    groupsReceived = true;
    latestGroups = message.group ?? [];
    const waiters = [...groupsWaiters];
    groupsWaiters.clear();
    waiters.forEach((resolve) => resolve());
  });
}

function waitForGroupsSnapshot() {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      groupsWaiters.delete(waiter);
      reject(new Error("[gRPC] /groups snapshot timeout"));
    }, SNAPSHOT_TIMEOUT);
    const waiter = () => {
      clearTimeout(timer);
      resolve();
    };
    groupsWaiters.add(waiter);
  });
}

async function groupsSnapshot() {
  const key = `${getBaseUrl()}|${getSecret()}`;
  if (groupsKey !== key) {
    groupsUnsubscribe?.();
    groupsUnsubscribe = null;
    groupsReceived = false;
    latestGroups = [];
    groupsKey = key;
  }
  ensureGroups();
  // 订阅后服务端立即推送首帧
  if (!groupsReceived) await waitForGroupsSnapshot();
  return latestGroups;
}

function findGroupItem(tag) {
  for (const group of latestGroups) {
    for (const item of group.items ?? []) {
      if (item.tag === tag) return item;
    }
  }
  return undefined;
}

// sing-box 的出站类型 → Clash 的策略组类型（ProxyList 按 Clash 名称过滤）
function toClashGroupType(group) {
  if (group.selectable) return "Selector";
  switch (group.type) {
    case "urltest":
      return "URLTest";
    case "fallback":
      return "Fallback";
    default:
      return group.type;
  }
}

function toClashProxies(groups) {
  const proxies = {};
  const delays = {};
  const groupTags = {};

  for (const group of groups) {
    for (const item of group.items ?? []) {
      delays[item.tag] = item.urlTestDelay > 0 ? item.urlTestDelay : 0;
      groupTags[item.tag] = group.tag;
    }
  }

  for (const group of groups) {
    proxies[group.tag] = {
      name: group.tag,
      type: toClashGroupType(group),
      now: group.selected || (group.items?.[0]?.tag ?? ""),
      all: (group.items ?? []).map((item) => item.tag),
      history: [],
    };
  }

  // 节点条目：已是策略组（嵌套组）的标签保留组对象，只补上延迟
  for (const [tag, delay] of Object.entries(delays)) {
    const history = delay > 0 ? [{ delay }] : [];
    if (proxies[tag]) {
      proxies[tag].history = history;
    } else {
      const item = findGroupItem(tag);
      proxies[tag] = {
        name: tag,
        type: item?.type ?? "",
        history,
        groupTag: groupTags[tag],
      };
    }
  }

  return proxies;
}

export async function getProxies() {
  return { proxies: toClashProxies(await groupsSnapshot()) };
}


export async function switchProxy(group, node) {
  await client().selectOutbound({ groupTag: group, outboundTag: node });
}

// URLTest 是异步的（服务端起 goroutine），这里等 Groups 流回传新的测试结果
async function urlTestOnce(nodeTag, groupTag, signal) {
  ensureGroups();
  const before = findGroupItem(nodeTag);
  // 注意：protoc-gen-es 只把 RPC 名首字母小写，URLTest 生成的本地名是 uRLTest
  await client().uRLTest({ outboundTag: groupTag || nodeTag }, signal ? { signal } : undefined);

  const deadline = Date.now() + URL_TEST_TIMEOUT;
  while (Date.now() < deadline) {
    await sleep(200);
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const now = findGroupItem(nodeTag);
    if (
      now &&
      (!before ||
        now.urlTestTime !== before.urlTestTime ||
        now.urlTestDelay !== before.urlTestDelay)
    ) {
      return now.urlTestDelay;
    }
  }
  return findGroupItem(nodeTag)?.urlTestDelay ?? 0;
}

export const testDelaysInBatch = (
  nodes,
  concurrency,
  onBatchUpdate,
  batchInterval,
) =>
  runBatchTest(
    nodes,
    async (node, signal) => {
      const delay = await urlTestOnce(node.name, node.groupTag, signal);
      return { delay: delay > 0 ? delay : "N/A" };
    },
    concurrency,
    onBatchUpdate,
    batchInterval,
  );

// ---------------------------------------------------------------- 版本 / 规则

export async function getVersion() {
  const version = await client().getVersion({});
  return {
    version: `sing-box ${version.version}`,
    apiVersion: version.apiVersion,
  };
}

// sing-box API 不暴露规则表：同源若还有 Clash API 则借用，否则返回空
export async function getRules() {
  try {
    const res = await fetch(`${getBaseUrl()}/rules`, {
      headers: authHeader(getSecret()),
    });
    if (!res.ok) return { rules: [] };
    const data = await res.json();
    return { rules: data.rules || [] };
  } catch {
    return { rules: [] };
  }
}
