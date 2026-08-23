#!/usr/bin/env python3
"""
동행복권 로또 6/45 전 회차 기록 수집기.

UI(로또 번호 대조기)에 그대로 불러올 수 있는 lotto_history.json 을 만듭니다.
표준 라이브러리만 사용하므로 별도 설치가 필요 없습니다.

사용법
    python fetch_lotto_history.py                     # 1회차 ~ 최신회차 전부
    python fetch_lotto_history.py -o data/lotto.json  # 저장 경로 지정
    python fetch_lotto_history.py --csv               # CSV도 같이 저장
    python fetch_lotto_history.py --to 1100           # 특정 회차까지만

이미 파일이 있으면 빠진 회차만 추가로 받습니다(이어받기).

참고: 2025년 사이트 개편으로 예전 common.do?method=getLottoNumber API 는
없어졌습니다(홈으로 302 리다이렉트). 지금은 당첨결과 페이지가 쓰는
/lt645/selectPstLt645InfoNew.do (한 번에 10회차씩) 를 사용합니다.
"""

import argparse
import http.client
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

API = "https://www.dhlottery.co.kr/lt645/selectPstLt645InfoNew.do"
REFERER = "https://www.dhlottery.co.kr/lt645/result"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"


def convert(item):
    """새 API 응답 한 건을 예전 스키마(UI가 읽는 형식)로 변환."""
    ymd = str(item.get("ltRflYmd") or "")
    date = f"{ymd[:4]}-{ymd[4:6]}-{ymd[6:8]}" if len(ymd) == 8 else ymd
    row = {
        "drwNo": item["ltEpsd"],
        "drwNoDate": date,
        "bnusNo": item["bnsWnNo"],
        "firstWinamnt": item.get("rnk1WnAmt"),
        "firstPrzwnerCo": item.get("rnk1WnNope"),
        "totSellamnt": item.get("wholEpsdSumNtslAmt"),
    }
    for i in range(1, 7):
        row[f"drwtNo{i}"] = item[f"tm{i}WnNo"]
    return row


def call_api(params, retries=4, timeout=20):
    """API 호출 후 회차 목록(list)을 반환. 실패하면 None."""
    url = f"{API}?{urllib.parse.urlencode(params)}"
    last_err = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": UA, "Accept": "application/json", "Referer": REFERER},
            )
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                body = json.loads(resp.read().decode("utf-8"))
            data = body.get("data") or {}
            return data.get("list") or []
        except (OSError, http.client.HTTPException, ValueError, KeyError) as e:
            # OSError 로 urllib.error.URLError·타임아웃·연결 끊김을 모두 잡는다.
            last_err = e
            time.sleep(0.8 * (attempt + 1))
    print(f"  ! 요청 실패 ({params}): {last_err}", file=sys.stderr)
    return None


def fetch_window(anchor):
    """anchor 회차가 들어있는 10회차 묶음을 받아 변환한 목록으로 반환."""
    rows = call_api({"srchDir": "center", "srchLtEpsd": anchor})
    if rows is None:
        return None
    return [convert(r) for r in rows]


def anchors_for(rounds, end):
    """필요한 회차를 덮는 최소한의 anchor 목록.

    center 조회는 anchor 를 포함한 10회차(anchor-5 ~ anchor+4)를 돌려주므로
    10회차 단위로 묶는다. 양 끝은 서버가 알아서 잘라준다.
    """
    ks = {(n + 5) // 10 for n in rounds}
    return sorted({min(max(10 * k, 5), end) for k in ks}, reverse=True)


def exists(no):
    """해당 회차가 이미 추첨됐는지 확인. 통신 자체가 실패하면 예외."""
    rows = call_api({"srchDir": "center", "srchLtEpsd": no})
    if rows is None:
        # 실패를 "없는 회차"로 오해하면 최신 회차를 엉뚱하게 잡는다.
        raise RuntimeError(f"{no}회차 확인 실패 - 네트워크 상태를 확인하세요")
    return any(r["ltEpsd"] == no for r in rows)


def find_latest():
    """이분 탐색으로 실제 최신 회차를 찾는다."""
    lo, hi = 1, 16  # hi 를 존재하지 않는 회차까지 넓힌다
    while exists(hi):
        lo, hi = hi, hi * 2
    while lo + 1 < hi:
        mid = (lo + hi) // 2
        if exists(mid):
            lo = mid
        else:
            hi = mid
    return lo


def load_existing(path):
    if not os.path.exists(path):
        return {}
    try:
        with open(path, encoding="utf-8") as f:
            rows = json.load(f)
        return {r["drwNo"]: r for r in rows if isinstance(r, dict) and "drwNo" in r}
    except (json.JSONDecodeError, KeyError, TypeError):
        print(f"기존 파일을 읽지 못해 처음부터 받습니다: {path}", file=sys.stderr)
        return {}


def write_csv(rows, path):
    with open(path, "w", encoding="utf-8-sig") as f:
        f.write("회차,추첨일,번호1,번호2,번호3,번호4,번호5,번호6,보너스\n")
        for r in rows:
            nums = ",".join(str(r[f"drwtNo{i}"]) for i in range(1, 7))
            f.write(f"{r['drwNo']},{r['drwNoDate']},{nums},{r['bnusNo']}\n")


def main():
    ap = argparse.ArgumentParser(description="동행복권 로또 6/45 회차 기록 수집기")
    ap.add_argument("-o", "--out", default="lotto_history.json", help="저장 경로")
    ap.add_argument("--from", dest="start", type=int, default=1, help="시작 회차")
    ap.add_argument("--to", dest="end", type=int, default=None, help="끝 회차 (기본: 최신)")
    ap.add_argument("--workers", type=int, default=4, help="동시 요청 수 (많이 올리면 서버가 연결을 끊습니다)")
    ap.add_argument("--csv", action="store_true", help="CSV도 함께 저장")
    args = ap.parse_args()

    known = load_existing(args.out)
    if known:
        print(f"기존 기록 {len(known)}회차를 읽었습니다.")

    end = args.end
    if end is None:
        print("최신 회차를 확인하는 중...")
        try:
            end = find_latest()
        except RuntimeError as e:
            print(f"{e}", file=sys.stderr)
            return 1
    print(f"대상: {args.start} ~ {end}회차")

    todo = [n for n in range(args.start, end + 1) if n not in known]
    if not todo:
        print("새로 받을 회차가 없습니다.")
    else:
        pages = anchors_for(todo, end)
        print(f"{len(todo)}개 회차를 받습니다 (페이지 {len(pages)}개, 동시 {args.workers}개)")
        done = 0
        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            futures = {pool.submit(fetch_window, a): a for a in pages}
            for fut in as_completed(futures):
                page = fut.result()
                done += 1
                for row in page or []:
                    known[row["drwNo"]] = row
                if done % 10 == 0 or done == len(pages):
                    print(f"  {done}/{len(pages)} 페이지")

    rows = [known[k] for k in sorted(known)]
    if not rows:
        print("받은 기록이 없습니다. 네트워크 상태를 확인하세요.", file=sys.stderr)
        return 1

    os.makedirs(os.path.dirname(os.path.abspath(args.out)) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False)

    print(f"\n저장 완료: {args.out}")
    print(f"  {len(rows)}회차 · {rows[0]['drwNoDate']} ~ {rows[-1]['drwNoDate']}")

    if args.csv:
        csv_path = os.path.splitext(args.out)[0] + ".csv"
        write_csv(rows, csv_path)
        print(f"  CSV: {csv_path}")

    missing = [n for n in range(rows[0]["drwNo"], rows[-1]["drwNo"] + 1) if n not in known]
    if missing:
        print(f"  빠진 회차 {len(missing)}개: {missing[:10]}{' ...' if len(missing) > 10 else ''}")
        print("  같은 명령을 한 번 더 실행하면 빠진 회차만 다시 받습니다.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
