// 通用批量延迟测试：并发执行 + 分批回调，两种后端共用
export function testDelaysInBatch(
  nodes,
  testOne,
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
    if (controller.signal.aborted) {
      buffer = {};
      return;
    }
    if (Object.keys(buffer).length > 0) {
      onBatchUpdate?.({ ...buffer });
      buffer = {};
    }
  };
  timer = setInterval(flush, batchInterval);

  async function worker() {
    while (index < nodes.length) {
      if (controller.signal.aborted) return;
      const i = index++;
      const node = nodes[i];
      try {
        const res = await testOne(node, controller.signal);
        const delay = Number(res?.delay);
        results[node.name] = Number.isFinite(delay) && delay > 0 ? delay : "N/A";
      } catch {
        results[node.name] = "N/A";
      }
      if (controller.signal.aborted) return;
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

  return {
    promise,
    abort: () => {
      clearInterval(timer);
      controller.abort();
    },
  };
}
