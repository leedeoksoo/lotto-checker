# 로또 6/45 번호 대조기

번호 6개를 고르면 역대 전 회차와 대조해 **1·2·3등에 들었던 회차**를 찾아 영수증 형태로 인쇄해 주는 웹 UI입니다.

- 1등 6개 일치 · 2등 5개+보너스 · 3등 5개 일치로 판정하고, 4·5등은 회차 수만 집계합니다.
- 1~3등이 없으면 최다 일치 개수와 가장 근접했던 회차를 대신 보여줍니다.
- 맞은 번호만 동행복권 공식 볼 색으로 채워 어디가 맞았는지 바로 보입니다.
- **추천 조합** — 1·2·3등에 든 적이 한 번도 없으면서 4등 이력이 가장 많은 조합을 전체 8,145,060가지에서 완전 탐색해 5개씩 뽑아줍니다. (과거 기록일 뿐 당첨 확률과는 무관합니다.)
- 대조한 번호는 **보관함**에 저장해두면 브라우저에 남아, 나중에 눌러서 그대로 다시 불러올 수 있습니다. JSON 으로 내보내고 가져올 수도 있습니다.

## 안드로이드에서 쓰기

두 가지 방법이 있습니다.

**1) 홈 화면에 추가 (설치할 것 없음)**

폰 크롬으로 배포 주소를 열고 메뉴 → «홈 화면에 추가». 아이콘이 생기고 주소창 없는
전체화면으로 뜹니다. 회차 기록까지 미리 받아두므로 **비행기모드에서도** 대조와 추천이
그대로 됩니다. 업데이트는 자동입니다.

**2) APK 설치**

[Releases](../../releases) 에서 최신 `lotto-checker-*.apk` 를 폰 브라우저로 내려받아
설치합니다. 처음 한 번은 «출처를 알 수 없는 앱» 설치를 허용해야 합니다.
(설정 → 앱 → 특별한 액세스 → 알 수 없는 앱 설치)

APK 는 태그를 밀면 GitHub Actions 가 만들어 Release 에 올립니다.

```bash
git tag v1.0.0 && git push origin v1.0.0
```

로컬에 JDK·Android SDK 가 있다면 직접 빌드할 수도 있습니다.

```bash
npm run android:sync     # vite build + cap sync
cd android && ./gradlew assembleDebug
# android/app/build/outputs/apk/debug/app-debug.apk
```

아이콘을 바꾸려면 `scripts/make_icons.py` 를 고치고 `npm run icons` 를 돌리면
PWA 아이콘과 안드로이드 런처 아이콘이 한 번에 다시 만들어집니다.

## 실행

```bash
git clone <저장소 주소>
cd lotto-history-checker

npm install
npm run fetch     # 동행복권에서 전 회차 기록을 받아 public/lotto_history.json 생성
npm run dev       # http://localhost:5173
```

`public/lotto_history.json`이 있으면 화면을 열 때 자동으로 적재됩니다. 없어도 UI는 뜨고, 화면 위쪽에서 파일을 직접 불러오거나 붙여넣을 수 있습니다.

## 회차 기록 받기

```bash
python3 scripts/fetch_lotto_history.py -o public/lotto_history.json
python3 scripts/fetch_lotto_history.py --csv          # CSV도 같이 저장
python3 scripts/fetch_lotto_history.py --to 1100      # 특정 회차까지만
```

표준 라이브러리만 쓰므로 별도 설치가 필요 없습니다. 이미 파일이 있으면 빠진 회차만 이어받습니다.

`npm run fetch`가 동작하지 않으면 `python3` 대신 `python`을 쓰는 환경일 수 있습니다. 그때는 `npm run fetch:win`을 쓰세요.

## 입력 형식

UI와 스크립트 모두 아래 세 가지를 읽습니다.

| 형식 | 예시 |
| --- | --- |
| 동행복권 API 원본 JSON | `[{"drwNo":1,"drwNoDate":"2002-12-07","drwtNo1":10,…,"bnusNo":16}]` |
| 간단 JSON | `[{"round":1,"date":"2002-12-07","numbers":[10,23,29,33,37,40],"bonus":16}]` |
| CSV / TSV | `1,2002-12-07,10,23,29,33,37,40,16` |

CSV는 헤더 줄이 있어도 되고, 회차·추첨일을 빼고 `번호6개,보너스` 7칸만 넣어도 읽습니다.

## 배포

### GitHub Pages

`main`에 push하면 `.github/workflows/deploy.yml`이 빌드해서 Pages에 올립니다. 저장소 **Settings → Pages → Source**를 `GitHub Actions`로 한 번 바꿔 주세요.

`public/lotto_history.json`을 커밋해 두면 배포본에도 그대로 실립니다. 배포할 때마다 최신 회차를 다시 받고 싶으면 **Settings → Secrets and variables → Actions → Variables**에 `FETCH_ON_DEPLOY = true`를 추가하세요.

### 폐쇄망 / 오프라인

빌드 결과물은 외부 요청 없이 동작하는 정적 파일이라 그대로 반입해서 쓸 수 있습니다.

```bash
npm run fetch        # 외부망에서 한 번만
npm run build        # dist/ 생성
# dist/ 를 통째로 반입한 뒤
npm run serve:dist   # 또는 python3 -m http.server 4173 --directory dist
```

`base: "./"`로 빌드하므로 도메인 루트든 하위 경로든 어디에 올려도 그대로 열립니다.

## 구조

```
├─ src/
│  ├─ LottoHistoryChecker.jsx   화면 전체 (마킹 용지 + 영수증 + 추천 + 보관함)
│  ├─ savedNumbers.js          보관함 저장/병합 로직 (localStorage)
│  ├─ recommend.js             추천 조합 완전 탐색 (부분집합 빈도표)
│  ├─ recommend.worker.js      탐색을 별도 스레드에서 실행
│  ├─ main.jsx
│  └─ index.css
├─ scripts/
│  └─ fetch_lotto_history.py    동행복권 회차 수집기 (표준 라이브러리만 사용)
├─ public/
│  ├─ lotto_history.json        회차 기록 — 있으면 자동 적재
│  └─ icons/                    PWA 아이콘 (scripts/make_icons.py 로 생성)
└─ .github/workflows/deploy.yml GitHub Pages 배포
```

## 참고

브라우저에서 동행복권 API를 직접 부르면 CORS에 막히기 때문에, 수집은 파이썬 스크립트가 맡고 UI는 만들어진 JSON만 읽는 구조로 나눠 두었습니다.

데이터 없이 화면부터 확인하려면 **샘플 넣기**를 누르세요. 형식만 같은 임의 조합이라 결과에 샘플 표시가 붙습니다.
