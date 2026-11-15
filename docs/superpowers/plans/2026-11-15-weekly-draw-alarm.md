# 토요일 당첨 결과 알림 구현 계획

> 설계: `docs/superpowers/specs/2026-11-15-weekly-draw-alarm-design.md`

**목표:** 매주 토 21:10 KST 에 앱이 꺼져 있어도 최신 회차를 받아 저장 번호와 대조하고 결과를 알림으로 띄운다.

**구조:** 순수 Java(일정·등수·문구) + 안드로이드 연결부(알람·Worker·알림·저장소) + Capacitor 플러그인 + JS 래퍼 + 보관함 UI.

**기술:** Capacitor 8, AlarmManager, WorkManager(`androidx.work:work-runtime`), NotificationCompat, JUnit 4.

---

## 파일

| 파일 | 역할 |
|---|---|
| `android/.../alarm/DrawSchedule.java` | 회차·다음 알람·재시도 마감 계산 (순수) |
| `android/.../alarm/RankCalc.java` | 등수 계산 (순수) |
| `android/.../alarm/ResultMessage.java` | 알림 제목·본문·펼침 줄 (순수) |
| `android/.../alarm/SavedStore.java` | SharedPreferences 사본 |
| `android/.../alarm/LottoApi.java` | 동행복권 회차 조회 |
| `android/.../alarm/Notifier.java` | 알림 채널·표시 |
| `android/.../alarm/AlarmScheduler.java` | 주간/재시도 알람 등록·취소 |
| `android/.../alarm/DrawCheckReceiver.java` | 알람 수신 → Worker |
| `android/.../alarm/DrawCheckWorker.java` | 조회·대조·알림·재시도 |
| `android/.../alarm/BootReceiver.java` | 재부팅·업데이트·권한 변경 시 재등록, 놓친 회차 확인 |
| `android/.../alarm/LottoAlarmPlugin.java` | JS 브리지 |
| `android/app/src/test/.../alarm/*Test.java` | 순수 클래스 단위 테스트 |
| `src/drawAlarm.js` | JS 래퍼 (웹에서는 no-op) |
| `src/LottoHistoryChecker.jsx` | 동기화 호출, 보관함 알림 행 |

## 작업

1. **순수 로직 + 테스트** — `DrawSchedule`, `RankCalc`, `ResultMessage` 와 JUnit 테스트. 로컬 JDK 로 실행해 통과 확인. 커밋.
2. **안드로이드 연결부** — `SavedStore`, `LottoApi`, `Notifier`, `AlarmScheduler`, 리시버 2개, `DrawCheckWorker`, 알림 아이콘, Manifest 권한·리시버, `work-runtime` 의존성. 커밋.
3. **플러그인** — `LottoAlarmPlugin` 과 `MainActivity` 등록. 커밋.
4. **웹** — `src/drawAlarm.js`, 컴포넌트 동기화·알림 행·스타일. `npm run build` 통과 확인. 커밋.
5. **CI** — `android.yml` 에 `./gradlew testDebugUnitTest` 단계. 커밋.
6. **검증** — 로컬에 안드로이드 SDK 가 없으므로 전체 컴파일·APK 는 GitHub Actions(workflow_dispatch) 로 확인.
