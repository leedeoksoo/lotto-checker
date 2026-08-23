/* 저장한 번호 조합 보관함 — localStorage 접근과 목록 조작을 모아둔 순수 모듈.
   React 에 의존하지 않으므로 컴포넌트 밖에서도 그대로 쓸 수 있습니다. */

export const STORAGE_KEY = "lc.saved.v1";
export const LIMIT = 100;

/* 정렬된 번호를 이어 만든 식별자. 같은 조합은 언제 저장해도 같은 id 가 됩니다. */
export const keyOf = (numbers) =>
  numbers
    .slice()
    .sort((a, b) => a - b)
    .join("-");

function validEntry(e) {
  if (!e || typeof e !== "object") return false;
  const ns = e.numbers;
  if (!Array.isArray(ns) || ns.length !== 6) return false;
  if (!ns.every((n) => Number.isInteger(n) && n >= 1 && n <= 45)) return false;
  return new Set(ns).size === 6;
}

/* 어떤 형태로 들어오든 저장 가능한 항목으로 다듬습니다. 못 쓰면 null. */
export function normalizeEntry(e) {
  if (!validEntry(e)) return null;
  const numbers = e.numbers.slice().sort((a, b) => a - b);
  const savedAt = typeof e.savedAt === "string" && e.savedAt ? e.savedAt : new Date().toISOString();
  return { id: keyOf(numbers), numbers, savedAt, summary: e.summary ?? null };
}

export function makeEntry(numbers, result) {
  return normalizeEntry({
    numbers,
    savedAt: new Date().toISOString(),
    summary: result
      ? {
          counts: { ...result.counts },
          best: result.best,
          bestCount: result.bestCount,
          total: result.total,
          source: result.source,
          isSample: !!result.isSample,
        }
      : null,
  });
}

/* 최신 저장순으로 정렬하고 상한을 넘으면 오래된 것부터 버립니다. */
function trim(list) {
  return list.slice().sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1)).slice(0, LIMIT);
}

export function loadSaved(storage = safeStorage()) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return trim(parsed.map(normalizeEntry).filter(Boolean));
  } catch {
    // 손상된 값은 빈 목록으로 취급하고 덮어쓰지 않습니다.
    return [];
  }
}

export function persist(list, storage = safeStorage()) {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch {
    // 프라이빗 모드나 용량 초과. 화면의 목록은 그대로 두고 저장만 포기합니다.
    return false;
  }
}

function safeStorage() {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/* 같은 조합이 이미 있으면 새로 추가하지 않고 갱신합니다. */
export function upsert(list, entry) {
  if (!entry) return list;
  return trim([entry, ...list.filter((e) => e.id !== entry.id)]);
}

export function removeAt(list, id) {
  return list.filter((e) => e.id !== id);
}

export function has(list, numbers) {
  if (!numbers || numbers.length !== 6) return false;
  const id = keyOf(numbers);
  return list.some((e) => e.id === id);
}

/* 가져온 목록을 기존 목록에 병합합니다. 같은 조합은 더 최근에 저장된 쪽을 남깁니다. */
export function mergeImported(list, incoming) {
  const byId = new Map(list.map((e) => [e.id, e]));
  let added = 0;
  for (const raw of incoming) {
    const e = normalizeEntry(raw);
    if (!e) continue;
    const cur = byId.get(e.id);
    if (!cur) added++;
    if (!cur || cur.savedAt < e.savedAt) byId.set(e.id, e);
  }
  return { list: trim([...byId.values()]), added };
}

export function toExport(list) {
  return JSON.stringify(list, null, 2);
}

export function parseImport(text) {
  const parsed = JSON.parse(text);
  const arr = Array.isArray(parsed) ? parsed : parsed?.saved;
  if (!Array.isArray(arr)) throw new Error("저장 목록 형식이 아닙니다.");
  return arr;
}

/* "3등 2회 · 최고 5개 일치 · 1,238회 기준" 같은 한 줄 요약. */
export function summaryLine(summary) {
  if (!summary) return "대조 기록 없음";
  const parts = [];
  for (const r of [1, 2, 3]) {
    const n = summary.counts?.[r] ?? summary.counts?.[String(r)] ?? 0;
    if (n > 0) parts.push(`${r}등 ${n}회`);
  }
  if (!parts.length) parts.push(`최고 ${summary.best}개 일치`);
  if (summary.total != null) parts.push(`${Number(summary.total).toLocaleString("ko-KR")}회 기준`);
  if (summary.isSample) parts.push("⚠ 샘플");
  return parts.join(" · ");
}
