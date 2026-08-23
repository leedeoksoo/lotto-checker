import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import LottoHistoryChecker from "./LottoHistoryChecker.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <LottoHistoryChecker />
  </StrictMode>
);

/* 서비스 워커 — 웹에서 홈 화면에 추가했을 때 오프라인으로 쓰기 위한 것입니다.
   안드로이드 앱(Capacitor)은 이미 파일을 앱 안에 들고 있으므로 등록하지 않습니다.
   앱에서까지 캐시를 겹쳐 두면 업데이트가 꼬이기만 합니다. */
if (!window.Capacitor) {
  import("virtual:pwa-register")
    .then(({ registerSW }) => registerSW({ immediate: true }))
    .catch(() => {});
}
