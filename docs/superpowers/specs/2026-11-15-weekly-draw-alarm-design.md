# 토요일 당첨 결과 알림 기능 설계

날짜: 2026-11-15
대상: 안드로이드 APK(Capacitor). 웹/PWA 에서는 동작하지 않는다(해당 UI 도 숨김).

## 목적

매주 토요일 21:10(한국 시간)에 최신 회차 당첨번호를 받아 보관함에 저장한 번호와 대조하고,
앱이 꺼져 있어도 결과를 안드로이드 알림으로 바로 보여준다.

## 범위

- 포함: 주간 알람, 백그라운드 조회·대조, 결과 알림, 알림 켜기/끄기 UI, 권한 처리, 재부팅 후 재등록, 놓친 회차 보충 확인.
- 제외: 웹 푸시, 서버, 텔레그램/이메일, 앱 내 결과 배너, 회차별 결과 이력 저장.

## 구조

새 npm 플러그인 없이 앱 안에 자체 Capacitor 플러그인 하나를 둔다. Gradle 의존성은
`androidx.work:work-runtime` 하나만 추가한다.

```
[웹뷰 React]                         [안드로이드 네이티브]
보관함 변경 ──► drawAlarm.js ──► LottoAlarmPlugin ──► SavedStore (SharedPreferences)
알림 토글   ──►               ──►                ──► AlarmScheduler ──► 토 21:10 KST 알람
                                                           │
                                     DrawCheckReceiver ◄───┘
                                           │ WorkManager (네트워크 연결 조건)
                                     DrawCheckWorker: 회차 조회 → RankCalc 대조 → 알림
                                     BootReceiver: 재부팅·앱 업데이트 후 알람 재등록
```

저장 번호의 원본은 계속 웹뷰 `localStorage`(`lc.saved.v1`)다. 네이티브 쪽은 사본만 가진다.

### JS: `src/drawAlarm.js`

`Capacitor.isNativePlatform()` 이 거짓이면 모든 함수가 아무 일도 하지 않고
`status()` 는 `{ supported: false }` 를 돌려준다.

- `syncSaved(list)` — 번호 배열만 뽑아(`[[3,14,22,30,41,45], ...]`) 네이티브에 넘긴다.
  컴포넌트에서 `persist()` 성공 직후와 앱 시작 시 `loadSaved()` 직후에 호출한다. 실패해도 무시.
- `enable()` — 알림 권한 요청 후 알람 등록. `{ enabled, notifPermission, exactAlarm }` 반환.
- `disable()` — 알람 취소.
- `status()` — `{ supported, enabled, notifPermission, exactAlarm, lastRound }`.
- `openExactAlarmSettings()` — 정확한 알람 권한 설정 화면 열기.
- `checkNow()` — 지금 즉시 조회·대조·알림 (시각 제한, 중복 방지 무시). 동작 확인용.

### Java: `android/app/src/main/java/io/github/leedeoksoo/lottochecker/alarm/`

- `LottoAlarmPlugin` — 위 JS 메서드의 브리지. `MainActivity` 에서 `registerPlugin` 으로 등록.
- `SavedStore` — SharedPreferences `lotto_alarm`: `saved`(JSON 문자열), `enabled`, `lastNotifiedRound`.
- `DrawSchedule` — 순수 계산(단위 테스트 대상).
  - `expectedRound(nowMillis)`: 1회차 2002-12-07 20:00 KST 기준, 지난 주 수 + 1. 단, 해당 주 토요일
    21:10 이전이면 직전 회차.
  - `nextAlarm(nowMillis)`: 다음 토요일 21:10 KST. minSdk 24 라 `java.time` 대신
    `Calendar` + `TimeZone.getTimeZone("Asia/Seoul")` 사용.
- `AlarmScheduler` — `canScheduleExactAlarms()` 면 `setExactAndAllowWhileIdle`,
  아니면 `setWindow(시각, 10분)`. 알람 한 번이 울릴 때마다 다음 알람을 새로 건다.
- `DrawCheckReceiver` — 알람 수신 → `DrawCheckWorker` 를 OneTimeWork(네트워크 연결 조건, 고유 이름
  `draw-check`, KEEP)로 넣고 다음 주 알람을 등록.
- `DrawCheckWorker` — 아래 "동작 흐름" 수행.
- `RankCalc` — 순수 함수. 6개 일치 1등, 5개+보너스 2등, 5개 3등, 4개 4등, 3개 5등, 그 외 0.
  웹의 `LottoHistoryChecker.jsx:322` 규칙과 같다.
- `BootReceiver` — `BOOT_COMPLETED`, `MY_PACKAGE_REPLACED` 수신 시 `enabled` 면 알람 재등록,
  그리고 `lastNotifiedRound < expectedRound(now)` 면 놓친 회차 확인 작업을 바로 넣는다.

### Manifest 추가

`POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`, `RECEIVE_BOOT_COMPLETED` 권한과
두 리시버 선언. (`USE_EXACT_ALARM` 은 알람시계류 앱 전용 정책이라 쓰지 않는다.)

## 동작 흐름 (DrawCheckWorker)

1. `round = expectedRound(now)`. `round <= lastNotifiedRound` 면 종료(checkNow 제외).
2. 저장 번호가 비어 있으면 알림 없이 종료(`lastNotifiedRound` 는 갱신하지 않음).
3. `GET https://www.dhlottery.co.kr/lt645/selectPstLt645InfoNew.do?srchDir=center&srchLtEpsd={round}`
   (Referer·User-Agent 는 `fetch_lotto_history.py` 와 동일, 타임아웃 15초). 응답 목록에서
   `ltEpsd == round` 인 항목의 `tm1WnNo~tm6WnNo`, `bnsWnNo` 를 읽는다.
4. 대조 후 알림 표시, `lastNotifiedRound = round` 저장.

## 실패 처리

- 네트워크 오류, 응답 파싱 실패, 해당 회차가 아직 없음 → 지금이 토요일 23:00 KST 이전이면
  10분 뒤 1회용 재시도 알람을 건다(주간 알람과 별개의 PendingIntent).
- 23:00 이 지나도 실패 → "{round}회 결과를 가져오지 못했어요. 앱에서 확인해 주세요." 알림 1회,
  `lastNotifiedRound` 는 갱신하지 않는다(재부팅 시 보충 확인 대상으로 남음).
- 알림 권한이 꺼져 있으면 작업은 돌지만 알림이 표시되지 않는다. UI 에서 상태로 알려준다.
- 저장된 JSON 이 손상되면 빈 목록으로 취급.

## 알림 내용

채널 `draw_result` ("당첨 결과", 기본 중요도). 탭하면 앱(`MainActivity`)을 연다.

- 제목: `1,198회 당첨 결과`
- 당첨이 있을 때 본문: `저장 12개 중 4등 1개 · 5등 2개`
- 펼친 내용(InboxStyle, 최대 5줄, 높은 등수 순): `4등  3 · 14 · 22 · 30 · 41 · 45`
- 모두 낙첨: `저장 12개 모두 낙첨 · 당첨번호 1 7 13 22 34 40 + 9`
- 1등 또는 2등이 있으면 제목 앞에 `🎉` 를 붙인다.

## 앱 UI

보관함 카드 하단(내보내기/가져오기 위)에 한 줄. `status().supported` 가 거짓이면 숨긴다.

- 스위치: `매주 토 21:10 결과 알림`
- 켤 때 알림 권한이 거부되면 스위치를 끄고 안내: `알림 권한이 꺼져 있어요. 설정에서 허용해 주세요.`
- `exactAlarm` 이 거짓이면 작은 안내 + 버튼: `정확한 시각 권한이 없어 최대 10분 늦을 수 있어요 [설정 열기]`
- 켜져 있을 때 보조 문구: `마지막 알림: 1,197회` (없으면 생략)과 작은 `지금 확인` 버튼(`checkNow`).

## 테스트

- JUnit (`android/app/src/test/.../alarm/`):
  - `RankCalcTest` — 1~5등, 보너스만 일치, 낙첨.
  - `DrawScheduleTest` — 토 21:09/21:10, 일요일, 연말, 기기 시간대가 KST 가 아닐 때의 다음 알람과 회차.
- `android.yml` 워크플로에 `./gradlew testDebugUnitTest` 단계 추가.
- 수동: APK 설치 → 알림 켜기 → `지금 확인` 으로 알림 표시 확인 → 앱 종료 후
  `adb shell cmd alarm` 로 알람 등록 확인.
- 웹: `npm run build` 후 브라우저에서 토글이 보이지 않고 콘솔 오류가 없는지 확인.
