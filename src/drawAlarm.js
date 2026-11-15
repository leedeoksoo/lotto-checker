/* 토요일 21:10 결과 알림 — 안드로이드 앱의 네이티브 플러그인(LottoAlarmPlugin) 래퍼.
   웹/PWA 에서는 모든 함수가 아무 일도 하지 않고, status() 는 { supported: false } 입니다. */

import { Capacitor, registerPlugin } from "@capacitor/core";

const native = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
const LottoAlarm = native ? registerPlugin("LottoAlarm") : null;

const UNSUPPORTED = { supported: false };

async function call(method, arg) {
  if (!LottoAlarm) return UNSUPPORTED;
  try {
    return (await LottoAlarm[method](arg)) ?? {};
  } catch {
    return UNSUPPORTED;
  }
}

/* 보관함 번호만 네이티브 사본으로 복사합니다. 실패해도 앱 동작에는 영향이 없습니다. */
export function syncSaved(list) {
  if (!LottoAlarm) return Promise.resolve();
  const saved = list.map((e) => e.numbers);
  return LottoAlarm.syncSaved({ saved }).catch(() => {});
}

export const status = () => call("status");
export const enable = () => call("enable");
export const disable = () => call("disable");
export const checkNow = () => call("checkNow");
export const openExactAlarmSettings = () => call("openExactAlarmSettings");
export const openNotificationSettings = () => call("openNotificationSettings");

/* "11월 21일(토) 21:10" — 기기 시간대와 무관하게 한국 시간으로 표시합니다. */
export function formatNextAt(ms) {
  if (!ms) return "";
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "numeric",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(ms))
      .map((x) => [x.type, x.value])
  );
  return `${p.month}월 ${p.day}일(${p.weekday}) ${p.hour}:${p.minute}`;
}
