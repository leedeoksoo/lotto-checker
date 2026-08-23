# 로또 6/45 번호 대조기

번호 6개를 고르면 역대 전 회차와 대조해 **1·2·3등에 들었던 회차**를 찾아 영수증 형태로 인쇄해 주는 웹 UI입니다.

- 1등 6개 일치 · 2등 5개+보너스 · 3등 5개 일치로 판정하고, 4·5등은 회차 수만 집계합니다.
- 1~3등이 없으면 최다 일치 개수와 가장 근접했던 회차를 대신 보여줍니다.
- 맞은 번호만 동행복권 공식 볼 색으로 채워 어디가 맞았는지 바로 보입니다.

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
│  ├─ LottoHistoryChecker.jsx   화면 전체 (마킹 용지 + 결과 영수증)
│  ├─ main.jsx
│  └─ index.css
├─ scripts/
│  └─ fetch_lotto_history.py    동행복권 회차 수집기 (표준 라이브러리만 사용)
├─ public/
│  └─ lotto_history.json        회차 기록 — 있으면 자동 적재
└─ .github/workflows/deploy.yml GitHub Pages 배포
```

## 참고

브라우저에서 동행복권 API를 직접 부르면 CORS에 막히기 때문에, 수집은 파이썬 스크립트가 맡고 UI는 만들어진 JSON만 읽는 구조로 나눠 두었습니다.

데이터 없이 화면부터 확인하려면 **샘플 넣기**를 누르세요. 형식만 같은 임의 조합이라 결과에 샘플 표시가 붙습니다.
