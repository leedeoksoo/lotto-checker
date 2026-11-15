/* 앱 안에 들어 있는 lotto_history.json 이후의 회차를 폰에 쌓아두는 캐시.
   안드로이드 앱이 동행복권에서 직접 받은 회차를 localStorage 에 원본 형식(drwNo, drwtNo1~6, bnusNo …)
   그대로 저장합니다. React 에 의존하지 않는 순수 모듈입니다. */

export const EXTRA_KEY = "lc.history.extra.v1";

/* 1회차 확인 시각 2002-12-07 21:10 KST(=12:10 UTC). 매주 한 회차씩, 한 주도 거른 적이 없습니다.
   네이티브 DrawSchedule.expectedRound 와 같은 계산입니다. */
const FIRST_CHECK = Date.UTC(2002, 11, 7, 12, 10);
const WEEK = 7 * 24 * 60 * 60 * 1000;

export function expectedRound(now = Date.now()) {
  if (now < FIRST_CHECK) return 0;
  return Math.floor((now - FIRST_CHECK) / WEEK) + 1;
}

/* 지금 가진 마지막 회차 이후로 받아야 할 범위. 받을 게 없으면 null. */
export function pendingRange(lastRound, now = Date.now()) {
  const to = expectedRound(now);
  return lastRound < to ? { from: lastRound + 1, to } : null;
}

function validRaw(r) {
  if (!r || typeof r !== "object" || !Number.isInteger(r.drwNo)) return false;
  const ns = [r.drwtNo1, r.drwtNo2, r.drwtNo3, r.drwtNo4, r.drwtNo5, r.drwtNo6, r.bnusNo];
  return ns.every((n) => Number.isInteger(n) && n >= 1 && n <= 45);
}

/* 기본 기록(baseMax 까지)보다 새 회차만 남기고, 회차 중복은 나중 것을 우선해 회차순으로 정렬합니다. */
export function mergeExtra(baseMax, prev, incoming) {
  const byRound = new Map();
  for (const r of [...prev, ...incoming]) {
    if (validRaw(r) && r.drwNo > baseMax) byRound.set(r.drwNo, r);
  }
  return [...byRound.values()].sort((a, b) => a.drwNo - b.drwNo);
}

export function loadExtra(storage = safeStorage()) {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(EXTRA_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(validRaw) : [];
  } catch {
    return [];
  }
}

export function saveExtra(rows, storage = safeStorage()) {
  if (!storage) return false;
  try {
    storage.setItem(EXTRA_KEY, JSON.stringify(rows));
    return true;
  } catch {
    return false;
  }
}

/* "lotto_history.json + 최신 12회" */
export function sourceLabel(extraCount) {
  return extraCount ? `lotto_history.json + 최신 ${extraCount}회` : "lotto_history.json";
}

function safeStorage() {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
