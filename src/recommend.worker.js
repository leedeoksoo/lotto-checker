/* 추천 조합 탐색을 별도 스레드에서 돌립니다. 화면이 멈추지 않게 하려는 목적입니다. */
import { buildTables, searchTop } from "./recommend";

self.onmessage = (e) => {
  const { history } = e.data || {};
  try {
    const tables = buildTables(history);
    let last = 0;
    const search = searchTop(tables, {
      onProgress: (p) => {
        // 진행률은 20번만 보냅니다. 너무 자주 보내면 그게 더 느립니다.
        if (p - last >= 0.05) {
          last = p;
          self.postMessage({ type: "progress", value: p });
        }
      },
    });
    self.postMessage({ type: "done", search });
  } catch (err) {
    self.postMessage({ type: "error", message: String(err?.message || err) });
  }
};
