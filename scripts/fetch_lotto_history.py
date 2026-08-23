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
"""

import argparse
import datetime as dt
import json
import os
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

API = "https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo={}"
FIRST_DRAW_DATE = dt.date(2002, 12, 7)  # 1회차 추첨일
UA = "Mozilla/5.0 (compatible; lotto-history-fetcher/1.0)"


def fetch_round(no, retries=3, timeout=10):
    """한 회차를 받아 dict로 반환. 아직 추첨되지 않은 회차면 None."""
    last_err = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(API.format(no), headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            if data.get("returnValue") != "success":
                return None
            return {
                "drwNo": data["drwNo"],
                "drwNoDate": data["drwNoDate"],
                "drwtNo1": data["drwtNo1"],
                "drwtNo2": data["drwtNo2"],
                "drwtNo3": data["drwtNo3"],
                "drwtNo4": data["drwtNo4"],
                "drwtNo5": data["drwtNo5"],
                "drwtNo6": data["drwtNo6"],
                "bnusNo": data["bnusNo"],
                "firstWinamnt": data.get("firstWinamnt"),
                "firstPrzwnerCo": data.get("firstPrzwnerCo"),
                "totSellamnt": data.get("totSellamnt"),
            }
        except (urllib.error.URLError, TimeoutError, ValueError, KeyError) as e:
            last_err = e
            time.sleep(0.6 * (attempt + 1))
    print(f"  ! {no}회차 실패: {last_err}", file=sys.stderr)
    return None


def estimate_latest():
    """오늘 날짜 기준 최신 회차 추정치(넉넉하게 +2)."""
    weeks = (dt.date.today() - FIRST_DRAW_DATE).days // 7
    return weeks + 3


def find_latest():
    """추정치에서 아래로 훑어 실제 최신 회차를 찾는다."""
    no = estimate_latest()
    while no > 1:
        if fetch_round(no) is not None:
            return no
        no -= 1
    return 1


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
    ap.add_argument("--workers", type=int, default=8, help="동시 요청 수")
    ap.add_argument("--csv", action="store_true", help="CSV도 함께 저장")
    args = ap.parse_args()

    known = load_existing(args.out)
    if known:
        print(f"기존 기록 {len(known)}회차를 읽었습니다.")

    end = args.end
    if end is None:
        print("최신 회차를 확인하는 중...")
        end = find_latest()
    print(f"대상: {args.start} ~ {end}회차")

    todo = [n for n in range(args.start, end + 1) if n not in known]
    if not todo:
        print("새로 받을 회차가 없습니다.")
    else:
        print(f"{len(todo)}개 회차를 받습니다 (동시 {args.workers}개)")
        done = 0
        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            futures = {pool.submit(fetch_round, n): n for n in todo}
            for fut in as_completed(futures):
                row = fut.result()
                done += 1
                if row:
                    known[row["drwNo"]] = row
                if done % 50 == 0 or done == len(todo):
                    print(f"  {done}/{len(todo)}")

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
