/* 추천 번호 탐색 엔진.
   "1·2·3등 이력이 없으면서 4등 이력이 가장 많은 조합"을 전체 8,145,060가지에서
   빠짐없이 찾습니다. React 에 의존하지 않는 순수 모듈이라 웹 워커에서도 씁니다.

   원리 ─ 조합마다 1,238회차를 일일이 대조하면 100억 번을 넘어 감당이 안 됩니다.
   대신 회차별 «4개 부분집합»과 «5개 부분집합»을 미리 세어두면, 조합 하나를
   판정하는 데 표 조회 몇 번이면 끝납니다.

     a4 = 내 조합의 4개 부분집합 15개가 각 회차에 들어간 횟수의 합 = Σ C(m,4)
     a5 = 5개 부분집합 6개의 합                                  = Σ C(m,5)
        (m = 그 회차와 겹친 개수)

   C(5,5)=1, C(6,5)=6 이므로 a5 = n5 + 6·n6 입니다. 곧 **a5 가 0이면 5개 이상
   맞은 회차가 없다**, 즉 1·2·3등 이력이 없다는 뜻입니다. 그리고 그때는
   C(4,4)=1 뿐이라 a4 가 곧 4등 횟수(n4)가 됩니다. */

const N = 45;
const K = 6;

/* 조합수 표 ─ C(x,1..6) 을 x = 0..44 에 대해 미리 계산 */
function binomTable() {
  const c = [];
  for (let k = 0; k <= K; k++) c.push(new Int32Array(N + 1));
  for (let x = 0; x <= N; x++) {
    c[0][x] = 1;
    for (let k = 1; k <= K; k++) {
      if (k > x) c[k][x] = 0;
      else if (k === x) c[k][x] = 1;
      else c[k][x] = c[k - 1][x - 1] + c[k][x - 1];
    }
  }
  return c;
}
const C = binomTable();
const C1 = C[1];
const C2 = C[2];
const C3 = C[3];
const C4 = C[4];
const C5 = C[5];
const C6 = C[6];

export const TOTAL_COMBOS = C[6][N]; // 8,145,060

/* 조합 번호 매기기(combinatorial number system).
   0-indexed 오름차순 x0<x1<...  →  ΣC(x_i, i+1). 조합마다 값이 하나씩 대응됩니다. */
export function rankOf(xs) {
  let r = 0;
  for (let i = 0; i < xs.length; i++) r += C[i + 1][xs[i]];
  return r;
}

/* 회차 기록에서 부분집합 빈도표를 만듭니다. */
export function buildTables(history) {
  const t4 = new Uint16Array(C[4][N]); // 148,995
  const t5 = new Uint16Array(C[5][N]); // 1,221,759
  const m6 = new Map();

  for (const d of history) {
    const xs = d.numbers.map((n) => n - 1).sort((a, b) => a - b);
    if (xs.length !== 6) continue;

    for (let i = 0; i < 6; i++)
      for (let j = i + 1; j < 6; j++)
        for (let k = j + 1; k < 6; k++)
          for (let l = k + 1; l < 6; l++) t4[C1[xs[i]] + C2[xs[j]] + C3[xs[k]] + C4[xs[l]]]++;

    for (let skip = 0; skip < 6; skip++) {
      let r = 0;
      let pos = 1;
      for (let i = 0; i < 6; i++) {
        if (i === skip) continue;
        r += C[pos][xs[i]];
        pos++;
      }
      t5[r]++;
    }

    const r6 = C1[xs[0]] + C2[xs[1]] + C3[xs[2]] + C4[xs[3]] + C5[xs[4]] + C6[xs[5]];
    m6.set(r6, (m6.get(r6) || 0) + 1);
  }
  return { t4, t5, m6, draws: history.length };
}

/* 조합 하나의 등수별 이력. 검산과 화면 표시에 씁니다. */
export function scoreCombo(numbers, tables) {
  const xs = numbers.map((n) => n - 1).sort((a, b) => a - b);
  const { t4, t5, m6 } = tables;

  let a4 = 0;
  for (let i = 0; i < 6; i++)
    for (let j = i + 1; j < 6; j++)
      for (let k = j + 1; k < 6; k++)
        for (let l = k + 1; l < 6; l++) a4 += t4[C1[xs[i]] + C2[xs[j]] + C3[xs[k]] + C4[xs[l]]];

  let a5 = 0;
  for (let skip = 0; skip < 6; skip++) {
    let r = 0;
    let pos = 1;
    for (let i = 0; i < 6; i++) {
      if (i === skip) continue;
      r += C[pos][xs[i]];
      pos++;
    }
    a5 += t5[r];
  }

  const n6 = m6.get(rankOf(xs)) || 0;
  const n5 = a5 - 6 * n6;
  const n4 = a4 - 5 * n5 - 15 * n6;
  return { n4, n5, n6 };
}

/* 점수(=4등 횟수)별 저수지 표본.
   상위 몇 점대는 조합이 수천 개일 수 있으므로, 전부 담지 않고
   점수마다 최대 cap개를 균등 확률로 뽑아 둡니다(reservoir sampling). */
class Buckets {
  constructor(cap, rng) {
    this.cap = cap;
    this.rng = rng;
    this.counts = new Int32Array(64);
    this.items = new Map(); // score → 평탄화된 번호 배열
  }
  add(score, a, b, c, d, e, f) {
    const seen = this.counts[score]++;
    let arr = this.items.get(score);
    if (!arr) {
      arr = [];
      this.items.set(score, arr);
    }
    if (arr.length < this.cap * 6) {
      arr.push(a, b, c, d, e, f);
      return;
    }
    const j = Math.floor(this.rng() * (seen + 1));
    if (j < this.cap) {
      const o = j * 6;
      arr[o] = a;
      arr[o + 1] = b;
      arr[o + 2] = c;
      arr[o + 3] = d;
      arr[o + 4] = e;
      arr[o + 5] = f;
    }
  }
  result() {
    const pools = {};
    for (const [score, arr] of this.items) {
      const out = [];
      for (let i = 0; i < arr.length; i += 6)
        out.push([arr[i] + 1, arr[i + 1] + 1, arr[i + 2] + 1, arr[i + 3] + 1, arr[i + 4] + 1, arr[i + 5] + 1]);
      pools[score] = out;
    }
    return { counts: Array.from(this.counts), pools };
  }
}

/* 전체 조합 완전 탐색.
   6중 루프를 돌되, 앞 5개가 정해진 시점에 계산해 둘 수 있는 값은 미리 더해 놓아
   가장 안쪽 루프에서는 표 조회 15번만 하도록 했습니다. */
export function searchTop(tables, { cap = 2000, rng = Math.random, onProgress } = {}) {
  const { t4, t5 } = tables;
  const buckets = new Buckets(cap, rng);
  let eligible = 0;
  let done = 0;

  const E3 = new Int32Array(10);
  const E4 = new Int32Array(5);

  for (let a = 0; a <= N - 6; a++) {
    const A1 = C1[a];
    for (let b = a + 1; b <= N - 5; b++) {
      const B2 = A1 + C2[b];
      for (let c = b + 1; c <= N - 4; c++) {
        // 2개 부분집합: {a,b} {a,c} {b,c}
        const c2ac = A1 + C2[c];
        const c2bc = C1[b] + C2[c];
        const C3r = B2 + C3[c]; // {a,b,c}
        for (let d = c + 1; d <= N - 3; d++) {
          const c3d = C3[d];
          // 3개 부분집합 4개: {a,b,c} {a,b,d} {a,c,d} {b,c,d}
          const d3_0 = C3r;
          const d3_1 = B2 + c3d;
          const d3_2 = c2ac + c3d;
          const d3_3 = c2bc + c3d;
          const D4r = C3r + C4[d]; // {a,b,c,d}
          // 2개 부분집합 6개 (다음 단계에서 3개짜리를 만들 때 필요)
          const c2d = C2[d];
          const d2_0 = B2;
          const d2_1 = c2ac;
          const d2_2 = c2bc;
          const d2_3 = A1 + c2d;
          const d2_4 = C1[b] + c2d;
          const d2_5 = C1[c] + c2d;

          for (let e = d + 1; e <= N - 2; e++) {
            const c3e = C3[e];
            const c4e = C4[e];
            // 3개 부분집합 10개
            E3[0] = d3_0;
            E3[1] = d3_1;
            E3[2] = d3_2;
            E3[3] = d3_3;
            E3[4] = d2_0 + c3e;
            E3[5] = d2_1 + c3e;
            E3[6] = d2_2 + c3e;
            E3[7] = d2_3 + c3e;
            E3[8] = d2_4 + c3e;
            E3[9] = d2_5 + c3e;
            // 4개 부분집합 5개
            E4[0] = D4r;
            E4[1] = d3_0 + c4e;
            E4[2] = d3_1 + c4e;
            E4[3] = d3_2 + c4e;
            E4[4] = d3_3 + c4e;

            const base5 = t5[D4r + C5[e]]; // {a,b,c,d,e} 자체
            const rest = N - 1 - e;
            if (base5 > 0) {
              // 앞 5개만으로 이미 5개 일치 회차가 있으니 f 를 무엇으로 해도 탈락
              done += rest;
              continue;
            }
            const base4 = t4[E4[0]] + t4[E4[1]] + t4[E4[2]] + t4[E4[3]] + t4[E4[4]];

            for (let f = e + 1; f < N; f++) {
              const c5f = C5[f];
              const a5 =
                t5[E4[0] + c5f] + t5[E4[1] + c5f] + t5[E4[2] + c5f] + t5[E4[3] + c5f] + t5[E4[4] + c5f];
              if (a5 > 0) continue; // 1·2·3등 이력 있음 → 제외

              const c4f = C4[f];
              const n4 =
                base4 +
                t4[E3[0] + c4f] +
                t4[E3[1] + c4f] +
                t4[E3[2] + c4f] +
                t4[E3[3] + c4f] +
                t4[E3[4] + c4f] +
                t4[E3[5] + c4f] +
                t4[E3[6] + c4f] +
                t4[E3[7] + c4f] +
                t4[E3[8] + c4f] +
                t4[E3[9] + c4f];

              eligible++;
              buckets.add(n4, a, b, c, d, e, f);
            }
            done += rest;
          }
        }
      }
      if (onProgress) onProgress(done / TOTAL_COMBOS);
    }
  }

  return { ...buckets.result(), eligible, total: TOTAL_COMBOS, draws: tables.draws };
}

/* 상위 점수부터 target개를 모을 때까지 긁어모은 후보 목록. */
export function topPool(search, target = 500) {
  const scores = Object.keys(search.pools)
    .map(Number)
    .sort((a, b) => b - a);
  const out = [];
  let minScore = null;
  for (const s of scores) {
    for (const combo of search.pools[s]) {
      out.push({ numbers: combo, n4: s });
      minScore = s;
    }
    if (out.length >= target) break;
  }
  // 마지막 점수대는 이미 무작위 표본이므로, 잘라내도 그 점수대의 균등 표본입니다.
  return { pool: out.slice(0, target), minScore, topScore: scores[0] ?? 0 };
}

/* 후보 풀에서 중복 없이 count개를 뽑습니다. */
export function pick(pool, count = 5, rng = Math.random) {
  const idx = [...pool.keys()];
  const out = [];
  for (let i = 0; i < count && idx.length; i++) {
    const j = Math.floor(rng() * idx.length);
    out.push(pool[idx[j]]);
    idx.splice(j, 1);
  }
  return out;
}
