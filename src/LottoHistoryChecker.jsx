import { useState, useRef, useMemo, useEffect } from "react";
import {
  loadSaved,
  persist,
  upsert,
  removeAt,
  has,
  makeEntry,
  keyOf,
  mergeImported,
  toExport,
  parseImport,
  summaryLine,
} from "./savedNumbers";
import { buildTables, searchTop, topPool, pick } from "./recommend";

/* ── 팔레트: 실제 로또 용지/영수증에서 가져옴 ───────────────────── */
const DESK = "#0E141B";
const DESK2 = "#151E29";
const PAPER = "#ECEFEC";
const INK = "#16202B";
const MUTED = "#6E7C88";
const LINE = "#243040";
const RANK_COLOR = { 1: "#D9A93C", 2: "#9FB2C2", 3: "#B4855A" };

/* 동행복권 공식 볼 색상 */
const ballColor = (n) =>
  n <= 10 ? "#FBC400" : n <= 20 ? "#69C8F2" : n <= 30 ? "#FF7272" : n <= 40 ? "#9AA6AF" : "#B0D840";

const pad = (n) => String(n).padStart(2, "0");
const comma = (n) => (n == null ? null : Number(n).toLocaleString("ko-KR"));

/* ── 회차 기록 파싱 ─────────────────────────────────────────────── */
function normalizeRow(r, idx) {
  if (!r || typeof r !== "object") return null;
  let six = null;
  let bonus = null;

  if (r.drwtNo1 != null) {
    six = [r.drwtNo1, r.drwtNo2, r.drwtNo3, r.drwtNo4, r.drwtNo5, r.drwtNo6].map(Number);
    bonus = Number(r.bnusNo);
  } else {
    const arr = r.numbers || r.nums || r.n || r.번호;
    if (Array.isArray(arr)) six = arr.map(Number);
    bonus = Number(r.bonus ?? r.bonusNo ?? r.bnusNo ?? r.보너스);
  }
  if (!six || six.length !== 6 || six.some((v) => !Number.isInteger(v) || v < 1 || v > 45)) return null;
  if (!Number.isInteger(bonus) || bonus < 1 || bonus > 45) return null;

  return {
    round: Number(r.drwNo ?? r.round ?? r.no ?? r.회차 ?? idx + 1),
    date: String(r.drwNoDate ?? r.date ?? r.추첨일 ?? "").slice(0, 10),
    numbers: six.slice().sort((a, b) => a - b),
    bonus,
    prize: r.firstWinamnt ?? r.prize ?? null,
    winners: r.firstPrzwnerCo ?? r.winners ?? null,
  };
}

function parseHistory(text) {
  const t = text.trim();
  if (!t) throw new Error("내용이 비어 있습니다.");

  if (t[0] === "[" || t[0] === "{") {
    let j;
    try {
      j = JSON.parse(t);
    } catch (e) {
      throw new Error(`JSON 형식이 아닙니다. (${e.message})`);
    }
    if (!Array.isArray(j)) j = j.draws || j.data || j.result || j.rows || (j.drwNo ? [j] : null);
    if (!Array.isArray(j)) throw new Error("JSON 안에서 회차 배열을 찾지 못했습니다.");
    const rows = j.map(normalizeRow).filter(Boolean);
    if (!rows.length) throw new Error("회차 배열은 찾았지만 번호 6개와 보너스를 읽을 수 있는 항목이 없습니다.");
    return rows;
  }

  // CSV / TSV
  const lines = t.split(/\r?\n/).filter((l) => l.trim());
  const rows = [];
  const bad = [];
  lines.forEach((line, i) => {
    const toks = line.split(/[,\t;|]/).map((s) => s.trim().replace(/^["']|["']$/g, ""));
    const dateTok = toks.find((s) => /^\d{4}[-./]\d{1,2}[-./]\d{1,2}$/.test(s));
    const nums = toks.filter((s) => /^\d+$/.test(s)).map(Number);

    let round = null;
    let six = null;
    let bonus = null;
    if (nums.length >= 8) {
      round = nums[0];
      six = nums.slice(1, 7);
      bonus = nums[7];
    } else if (nums.length === 7) {
      six = nums.slice(0, 6);
      bonus = nums[6];
    }

    const ok =
      six &&
      six.length === 6 &&
      new Set(six).size === 6 &&
      six.every((v) => v >= 1 && v <= 45) &&
      bonus >= 1 &&
      bonus <= 45;

    if (!ok) {
      if (i > 0 || nums.length >= 6) bad.push(i + 1);
      return;
    }
    rows.push({
      round: round ?? rows.length + 1,
      date: dateTok ? dateTok.replace(/[./]/g, "-") : "",
      numbers: six.slice().sort((a, b) => a - b),
      bonus,
      prize: null,
      winners: null,
    });
  });

  if (!rows.length)
    throw new Error("한 줄도 읽지 못했습니다. 각 줄이 «회차, 추첨일, 번호6개, 보너스» 순서인지 확인하세요.");
  if (bad.length) rows.warn = bad;
  return rows;
}

/* ── 샘플 데이터: 형식만 같은 임의 조합 ─────────────────────────── */
function makeSample(count = 1150) {
  let seed = 20021207;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const out = [];
  const start = new Date(Date.UTC(2002, 11, 7));
  for (let i = 0; i < count; i++) {
    const pool = Array.from({ length: 45 }, (_, k) => k + 1);
    for (let k = pool.length - 1; k > 0; k--) {
      const j = Math.floor(rnd() * (k + 1));
      [pool[k], pool[j]] = [pool[j], pool[k]];
    }
    const d = new Date(start.getTime() + i * 7 * 86400000);
    out.push({
      round: i + 1,
      date: d.toISOString().slice(0, 10),
      numbers: pool.slice(0, 6).sort((a, b) => a - b),
      bonus: pool[6],
      prize: null,
      winners: null,
    });
  }
  return out;
}

/* ── 볼 ─────────────────────────────────────────────────────────── */
function Ball({ n, size = 34, dim = false, ring = false }) {
  return (
    <span
      className="lc-ball"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        background: dim ? "transparent" : ballColor(n),
        color: dim ? "#94A3AF" : "#1B1B1B",
        border: dim ? `1px solid #C3C9C4` : ring ? `2px solid ${INK}` : "none",
      }}
    >
      {pad(n)}
    </span>
  );
}

/* ── 영수증 아랫단 톱니 ─────────────────────────────────────────── */
function TearEdge() {
  let d = "M0,0 H200";
  for (let x = 200; x > 0; x -= 8) d += ` L${x - 4},9 L${x - 8},0`;
  d += " Z";
  return (
    <svg viewBox="0 0 200 9" preserveAspectRatio="none" style={{ display: "block", width: "100%", height: 9 }}>
      <path d={d} fill={PAPER} />
    </svg>
  );
}

function Row({ label, value }) {
  return (
    <div className="lc-dotrow">
      <span>{label}</span>
      <i />
      <strong>{value}</strong>
    </div>
  );
}

/* ── 메인 ───────────────────────────────────────────────────────── */
export default function LottoHistoryChecker() {
  const [history, setHistory] = useState([]);
  const [source, setSource] = useState(null);
  const [isSample, setIsSample] = useState(false);
  const [picked, setPicked] = useState([]);
  const [manual, setManual] = useState("");
  const [result, setResult] = useState(null);
  const [printKey, setPrintKey] = useState(0);
  const [error, setError] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [booting, setBooting] = useState(true);
  const [saved, setSaved] = useState([]);
  const [savedNote, setSavedNote] = useState("");
  const [reco, setReco] = useState({ status: "idle", progress: 0 });
  const [recos, setRecos] = useState([]);
  const fileRef = useRef(null);
  const savedFileRef = useRef(null);
  const workerRef = useRef(null);

  /* 보관함은 브라우저에만 있습니다. 첫 렌더 뒤에 읽어 SSR/프리렌더와도 어긋나지 않게 합니다. */
  useEffect(() => {
    setSaved(loadSaved());
  }, []);

  /* 저장소에 같이 배포된 lotto_history.json 이 있으면 시작할 때 자동으로 적재 */
  useEffect(() => {
    let alive = true;
    const url = new URL("lotto_history.json", document.baseURI).href;
    fetch(url, { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error("no-file"))))
      .then((text) => {
        if (!alive) return;
        const rows = parseHistory(text);
        rows.sort((a, b) => a.round - b.round);
        setHistory(rows);
        setSource("lotto_history.json");
        setIsSample(false);
      })
      .catch(() => {})
      .finally(() => alive && setBooting(false));
    return () => {
      alive = false;
    };
  }, []);

  const span = useMemo(() => {
    if (!history.length) return null;
    const dates = history.map((h) => h.date).filter(Boolean).sort();
    return {
      rounds: `${history[0].round} ~ ${history[history.length - 1].round}`,
      dates: dates.length ? `${dates[0]} ~ ${dates[dates.length - 1]}` : "기록 없음",
    };
  }, [history]);

  const toggle = (n) => {
    setResult(null);
    setPicked((p) => (p.includes(n) ? p.filter((x) => x !== n) : p.length >= 6 ? p : [...p, n].sort((a, b) => a - b)));
  };

  const auto = () => {
    setResult(null);
    const pool = Array.from({ length: 45 }, (_, i) => i + 1);
    const out = [];
    while (out.length < 6) out.push(...pool.splice(Math.floor(Math.random() * pool.length), 1));
    setPicked(out.sort((a, b) => a - b));
    setManual("");
  };

  const applyManual = (v) => {
    setManual(v);
    setResult(null);
    const nums = (v.match(/\d+/g) || []).map(Number).filter((n) => n >= 1 && n <= 45);
    const uniq = [...new Set(nums)].slice(0, 6);
    if (uniq.length) setPicked(uniq.sort((a, b) => a - b));
    else setPicked([]);
  };

  const loadText = (text, label, sample = false) => {
    try {
      const rows = parseHistory(text);
      rows.sort((a, b) => a.round - b.round);
      setHistory(rows);
      setSource(label);
      setIsSample(sample);
      setResult(null);
      setError(rows.warn ? `${rows.length}회차를 읽었습니다. ${rows.warn.length}줄은 형식이 달라 건너뛰었습니다.` : "");
      setPasteOpen(false);
    } catch (e) {
      setError(e.message);
    }
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => loadText(String(reader.result), f.name);
    reader.onerror = () => setError(`${f.name} 파일을 읽지 못했습니다.`);
    reader.readAsText(f, "utf-8");
    e.target.value = "";
  };

  const loadSample = () => {
    const rows = makeSample();
    setHistory(rows);
    setSource("샘플 (임의 생성)");
    setIsSample(true);
    setResult(null);
    setError("");
    setPasteOpen(false);
  };

  const run = () => {
    const set = new Set(picked);
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const hits = [];
    let best = 0;
    let bestCount = 0;
    let nearest = [];

    for (const d of history) {
      let m = 0;
      for (const n of d.numbers) if (set.has(n)) m++;
      const bonusHit = set.has(d.bonus);
      const rank = m === 6 ? 1 : m === 5 && bonusHit ? 2 : m === 5 ? 3 : m === 4 ? 4 : m === 3 ? 5 : 0;
      if (rank) counts[rank]++;
      if (rank && rank <= 3) hits.push({ ...d, rank, matched: m, bonusHit });
      if (m > best) {
        best = m;
        bestCount = 1;
        nearest = [d];
      } else if (m === best) {
        bestCount++;
        if (nearest.length < 60) nearest.push(d);
      }
    }

    hits.sort((a, b) => a.rank - b.rank || b.round - a.round);
    setResult({
      counts,
      hits,
      best,
      bestCount,
      nearest: nearest.slice(-3).reverse(),
      total: history.length,
      picked: picked.slice(),
      source,
      isSample,
    });
    setPrintKey((k) => k + 1);
  };

  /* 보관함 ─────────────────────────────────────────────────────── */
  const commitSaved = (next, note = "") => {
    setSaved(next);
    setSavedNote(persist(next) ? note : "이 브라우저에는 저장할 수 없습니다. (프라이빗 모드이거나 저장 공간이 가득 찼습니다)");
  };

  const isSaved = result ? has(saved, result.picked) : false;

  const toggleSave = () => {
    if (!result) return;
    if (isSaved) {
      commitSaved(removeAt(saved, keyOf(result.picked)), "보관함에서 뺐습니다.");
    } else {
      commitSaved(upsert(saved, makeEntry(result.picked, result)), "보관함에 저장했습니다.");
    }
  };

  const recall = (entry) => {
    setPicked(entry.numbers.slice());
    setManual(entry.numbers.map(pad).join(" "));
    setResult(null);
    setSavedNote("");
  };

  const exportSaved = () => {
    const blob = new Blob([toExport(saved)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lotto-saved-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onSavedFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { list, added } = mergeImported(saved, parseImport(String(reader.result)));
        commitSaved(list, `${list.length}개 중 ${added}개를 새로 가져왔습니다.`);
      } catch (err) {
        setSavedNote(`가져오지 못했습니다. ${err.message}`);
      }
    };
    reader.onerror = () => setSavedNote(`${f.name} 파일을 읽지 못했습니다.`);
    reader.readAsText(f, "utf-8");
  };

  /* 추천 조합 ───────────────────────────────────────────────────── */
  /* 회차 기록이 바뀌면 앞선 탐색 결과는 의미가 없으므로 버립니다. */
  useEffect(() => {
    setReco({ status: "idle", progress: 0 });
    setRecos([]);
  }, [history]);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const applySearch = (search) => {
    const { pool, topScore, minScore } = topPool(search, 500);
    if (!pool.length) {
      setReco({ status: "error", message: "조건에 맞는 조합을 찾지 못했습니다." });
      return;
    }
    setReco({
      status: "ready",
      progress: 1,
      pool,
      topScore,
      minScore,
      eligible: search.eligible,
      total: search.total,
      draws: search.draws,
      isSample,
    });
    setRecos(pick(pool, 5));
  };

  /* 워커를 쓸 수 없는 환경(옛 브라우저·file://)에서는 이 자리에서 계산합니다. */
  const runInline = (rows) => {
    try {
      applySearch(searchTop(buildTables(rows)));
    } catch (e) {
      setReco({ status: "error", message: e.message });
    }
  };

  const drawRecos = () => {
    if (!history.length || reco.status === "working") return;
    if (reco.status === "ready") {
      setRecos(pick(reco.pool, 5));
      return;
    }

    setReco({ status: "working", progress: 0 });
    const rows = history.map((h) => ({ numbers: h.numbers }));
    try {
      const w = new Worker(new URL("./recommend.worker.js", import.meta.url), { type: "module" });
      workerRef.current = w;
      w.onmessage = (e) => {
        const m = e.data;
        if (m.type === "progress") {
          setReco((r) => (r.status === "working" ? { ...r, progress: m.value } : r));
        } else {
          w.terminate();
          workerRef.current = null;
          if (m.type === "done") applySearch(m.search);
          else setReco({ status: "error", message: m.message });
        }
      };
      w.onerror = () => {
        w.terminate();
        workerRef.current = null;
        runInline(rows);
      };
      w.postMessage({ history: rows });
    } catch {
      runInline(rows);
    }
  };

  const ready = picked.length === 6 && history.length > 0;
  const hasWin = result && result.hits.length > 0;

  return (
    <div className="lc-root">
      <style>{`
        .lc-root{
          --sans:"Pretendard",-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif;
          --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace;
          font-family:var(--sans);
          background:
            radial-gradient(120% 80% at 50% -10%, ${DESK2} 0%, ${DESK} 60%);
          color:#C9D4DD; min-height:100vh;
          /* 안드로이드 앱·노치 화면에서 상태표시줄 아래로 내용이 들어가지 않게 합니다. */
          padding:calc(32px + env(safe-area-inset-top)) calc(20px + env(safe-area-inset-right))
                  calc(56px + env(safe-area-inset-bottom)) calc(20px + env(safe-area-inset-left));
          -webkit-font-smoothing:antialiased;
        }
        .lc-wrap{max-width:1020px;margin:0 auto;}
        @media (max-width:520px){
          .lc-root{padding-top:calc(18px + env(safe-area-inset-top));padding-left:calc(12px + env(safe-area-inset-left));
            padding-right:calc(12px + env(safe-area-inset-right));}
          .lc-h1{font-size:27px;}
          .lc-bar{padding:10px;gap:6px;}
          .lc-status{width:100%;margin-bottom:4px;}
          .lc-btn{flex:1 1 auto;white-space:nowrap;padding:8px 10px;font-size:12px;}
          .lc-sheet,.lc-receipt-body{padding-left:13px;padding-right:13px;}
          .lc-cells{gap:4px;}
          .lc-cell{font-size:12px;}
        }
        .lc-eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.22em;color:${MUTED};}
        .lc-h1{font-size:clamp(30px,5vw,46px);font-weight:800;letter-spacing:-.035em;color:#F0F5F8;margin:10px 0 8px;line-height:1.05;}
        .lc-sub{font-size:14px;color:#8C9AA6;max-width:44ch;line-height:1.6;}

        .lc-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:24px 0 0;
          padding:12px 14px;border:1px solid ${LINE};border-radius:10px;background:rgba(255,255,255,.02);}
        .lc-status{font-family:var(--mono);font-size:12px;color:#9FB0BC;margin-right:auto;}
        .lc-status b{color:#E6EEF3;font-weight:600;}
        .lc-tag{font-family:var(--mono);font-size:10px;letter-spacing:.1em;padding:2px 6px;border-radius:3px;
          background:#3A2F16;color:#E0B23C;margin-left:8px;}

        .lc-btn{font-family:var(--sans);font-size:13px;font-weight:600;padding:7px 13px;border-radius:7px;
          border:1px solid ${LINE};background:transparent;color:#B6C4CE;cursor:pointer;transition:.15s;}
        .lc-btn:hover{background:rgba(255,255,255,.06);color:#EAF2F7;}
        .lc-btn:focus-visible{outline:2px solid #69C8F2;outline-offset:2px;}

        .lc-err{margin-top:10px;font-size:13px;line-height:1.5;color:#F0B4B4;
          border-left:2px solid #FF7272;padding:6px 0 6px 12px;}

        .lc-col{display:flex;flex-direction:column;gap:18px;min-width:0;}
        .lc-grid2{display:grid;grid-template-columns:minmax(0,380px) minmax(0,1fr);gap:22px;margin-top:22px;align-items:start;}
        @media (max-width:820px){
          .lc-grid2{grid-template-columns:1fr;}
          /* 한 줄로 쌓일 때는 «용지 → 결과 → 추천 → 보관함» 순이 자연스럽습니다.
             display:contents 로 왼쪽 열을 풀어 순서를 다시 매깁니다. */
          .lc-col{display:contents;}
          .lc-sheet{order:1;}
          .lc-resultcol{order:2;}
          .lc-reco{order:3;}
          .lc-vault{order:4;}
        }

        .lc-paper{background:${PAPER};color:${INK};border-radius:4px;}
        .lc-sheet{padding:18px 18px 20px;box-shadow:0 18px 40px rgba(0,0,0,.45);}
        .lc-sheet-head{display:flex;justify-content:space-between;align-items:baseline;
          font-family:var(--mono);font-size:10px;letter-spacing:.16em;color:#5C6B78;
          border-bottom:1.5px solid ${INK};padding-bottom:8px;margin-bottom:14px;}

        .lc-cells{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;}
        .lc-cell{aspect-ratio:1;border:1px solid #C6CDC7;border-radius:2px;background:#F7F9F6;
          font-family:var(--mono);font-size:13px;font-weight:600;color:#4A5A66;cursor:pointer;
          display:flex;align-items:center;justify-content:center;transition:.12s;padding:0;}
        .lc-cell:hover:not(:disabled){border-color:${INK};color:${INK};}
        .lc-cell:disabled{opacity:.35;cursor:not-allowed;}
        .lc-cell[data-on="1"]{background:${INK};border-color:${INK};color:${PAPER};}
        .lc-cell:focus-visible{outline:2px solid #2F7FBF;outline-offset:1px;}

        .lc-slots{display:flex;gap:6px;margin-top:16px;justify-content:space-between;}
        .lc-ball{border-radius:999px;display:inline-flex;align-items:center;justify-content:center;
          font-family:var(--mono);font-weight:700;flex:none;}
        .lc-slot-empty{width:34px;height:34px;border-radius:999px;border:1px dashed #B9C1BA;flex:none;}

        .lc-input{width:100%;margin-top:14px;box-sizing:border-box;font-family:var(--mono);font-size:13px;
          padding:9px 11px;border:1px solid #C6CDC7;border-radius:4px;background:#F7F9F6;color:${INK};}
        .lc-input:focus{outline:2px solid #2F7FBF;outline-offset:0;border-color:transparent;}
        .lc-mini{display:flex;gap:8px;margin-top:10px;}
        .lc-mini button{flex:1;font-size:12px;font-weight:600;padding:8px;border-radius:4px;cursor:pointer;
          border:1px solid #C6CDC7;background:transparent;color:#4A5A66;font-family:var(--sans);}
        .lc-mini button:hover{background:#E2E6E1;color:${INK};}

        .lc-run{width:100%;margin-top:16px;padding:14px;border:0;border-radius:5px;cursor:pointer;
          background:${INK};color:${PAPER};font-family:var(--sans);font-size:15px;font-weight:700;letter-spacing:-.01em;}
        .lc-run:disabled{background:#C6CDC7;color:#8A948E;cursor:not-allowed;}
        .lc-run:hover:not(:disabled){background:#0B121A;}

        .lc-receipt{box-shadow:0 18px 40px rgba(0,0,0,.45);}
        .lc-receipt-body{padding:20px 22px 16px;}
        .lc-rhead{font-family:var(--mono);font-size:11px;letter-spacing:.18em;color:#5C6B78;
          display:flex;justify-content:space-between;border-bottom:1.5px solid ${INK};padding-bottom:9px;}
        .lc-dotrow{display:flex;align-items:baseline;gap:6px;font-family:var(--mono);font-size:12px;
          color:#5C6B78;margin-top:7px;}
        .lc-dotrow i{flex:1;border-bottom:1px dotted #B4BCB6;transform:translateY(-3px);}
        .lc-dotrow strong{color:${INK};font-weight:600;}

        .lc-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:18px 0 6px;}
        .lc-card{border:1.5px solid #D5DBD5;border-radius:3px;padding:12px 10px;text-align:center;}
        .lc-card span{font-family:var(--mono);font-size:10px;letter-spacing:.16em;color:#6B7A85;display:block;}
        .lc-card b{font-family:var(--mono);font-size:30px;font-weight:700;line-height:1.15;display:block;color:#A8B2AB;}
        .lc-card[data-hit="1"]{border-width:2px;}
        .lc-note{font-family:var(--mono);font-size:11px;color:#6B7A85;margin-top:10px;}

        .lc-sep{border:0;border-top:1px dashed #B4BCB6;margin:18px 0 14px;}
        .lc-secttl{font-family:var(--mono);font-size:10px;letter-spacing:.2em;color:#6B7A85;margin-bottom:12px;}

        .lc-hit{border-top:1px solid #DDE2DD;padding:13px 0 12px;animation:lcPrint .34s ease both;}
        .lc-hit:first-child{border-top:0;}
        .lc-hitline{display:flex;align-items:center;gap:10px;font-family:var(--mono);font-size:12px;color:#5C6B78;}
        .lc-round{color:${INK};font-weight:700;font-size:14px;}
        .lc-rank{margin-left:auto;font-family:var(--mono);font-size:11px;font-weight:700;letter-spacing:.1em;
          padding:3px 8px;border-radius:2px;color:#FFF;}
        .lc-balls{display:flex;gap:5px;margin-top:9px;flex-wrap:wrap;align-items:center;}
        .lc-plus{font-family:var(--mono);font-size:12px;color:#8A948E;margin:0 2px;}
        .lc-prize{font-family:var(--mono);font-size:11px;color:#6B7A85;margin-top:8px;}

        .lc-empty{text-align:center;padding:26px 8px 20px;}
        .lc-empty h3{font-size:17px;font-weight:700;color:${INK};margin:0 0 6px;letter-spacing:-.02em;}
        .lc-empty p{font-size:13px;color:#6B7A85;margin:0;line-height:1.6;}

        .lc-ghost{padding:46px 20px;text-align:center;font-family:var(--mono);font-size:12px;
          color:#8A948E;line-height:1.9;}

        .lc-paste{width:100%;box-sizing:border-box;margin-top:10px;height:110px;font-family:var(--mono);
          font-size:12px;padding:10px;border-radius:8px;border:1px solid ${LINE};
          background:rgba(0,0,0,.25);color:#C9D4DD;resize:vertical;}
        .lc-hint{font-family:var(--mono);font-size:11px;color:${MUTED};margin-top:8px;line-height:1.7;}

        .lc-reco{padding:16px 18px 18px;box-shadow:0 12px 28px rgba(0,0,0,.35);}
        .lc-reco-lead{font-family:var(--mono);font-size:11px;color:#6B7A85;line-height:1.7;margin-bottom:12px;}
        .lc-reco-row{border-top:1px dashed #C6CDC7;padding:11px 0 10px;display:flex;align-items:center;gap:10px;
          flex-wrap:wrap;}
        .lc-reco-balls{display:flex;gap:5px;flex-wrap:wrap;}
        .lc-reco-n4{font-family:var(--mono);font-size:11px;color:#5C6B78;margin-left:auto;white-space:nowrap;}
        .lc-reco-n4 b{color:${INK};font-weight:700;}
        .lc-reco-use{font-family:var(--sans);font-size:11px;font-weight:600;padding:5px 10px;border-radius:4px;
          border:1px solid #C6CDC7;background:transparent;color:#4A5A66;cursor:pointer;}
        .lc-reco-use:hover{background:#E2E6E1;color:${INK};}
        .lc-reco-btn{width:100%;margin-top:14px;padding:11px;border:0;border-radius:5px;cursor:pointer;
          background:${INK};color:${PAPER};font-family:var(--sans);font-size:14px;font-weight:700;}
        .lc-reco-btn:disabled{background:#C6CDC7;color:#8A948E;cursor:not-allowed;}
        .lc-reco-btn:hover:not(:disabled){background:#0B121A;}
        .lc-bar-progress{height:3px;background:#D5DBD5;border-radius:2px;overflow:hidden;margin-top:10px;}
        .lc-bar-progress i{display:block;height:100%;background:${INK};transition:width .2s;}
        .lc-reco-foot{font-family:var(--mono);font-size:10px;color:#8A948E;margin-top:11px;line-height:1.7;}

        .lc-vault{padding:16px 18px 18px;box-shadow:0 12px 28px rgba(0,0,0,.35);}
        .lc-vault-list{list-style:none;margin:0;padding:0;}
        .lc-item{border-top:1px dashed #C6CDC7;padding:12px 0 11px;}
        .lc-item:first-child{border-top:0;padding-top:4px;}
        .lc-item-balls{display:flex;gap:5px;flex-wrap:wrap;}
        .lc-item-meta{font-family:var(--mono);font-size:11px;color:#6B7A85;margin-top:8px;line-height:1.6;}
        .lc-item-acts{display:flex;gap:6px;margin-top:9px;}
        .lc-item-acts button{font-family:var(--sans);font-size:11px;font-weight:600;padding:5px 10px;border-radius:4px;
          border:1px solid #C6CDC7;background:transparent;color:#4A5A66;cursor:pointer;}
        .lc-item-acts button:hover{background:#E2E6E1;color:${INK};}
        .lc-vault-empty{font-family:var(--mono);font-size:11px;color:#8A948E;line-height:1.8;padding:6px 0 2px;}
        .lc-vault-foot{display:flex;gap:6px;margin-top:14px;border-top:1px solid #DDE2DD;padding-top:12px;}
        .lc-vault-foot button{flex:1;font-family:var(--sans);font-size:11px;font-weight:600;padding:6px;border-radius:4px;
          border:1px solid #C6CDC7;background:transparent;color:#4A5A66;cursor:pointer;}
        .lc-vault-foot button:hover:not(:disabled){background:#E2E6E1;color:${INK};}
        .lc-vault-foot button:disabled{opacity:.4;cursor:not-allowed;}
        .lc-vault-note{font-family:var(--mono);font-size:11px;color:#5C6B78;margin-top:10px;line-height:1.6;}

        .lc-save{font-family:var(--sans);font-size:11px;font-weight:700;letter-spacing:0;padding:4px 10px;
          border-radius:4px;border:1px solid ${INK};background:transparent;color:${INK};cursor:pointer;}
        .lc-save:hover{background:${INK};color:${PAPER};}
        .lc-save[data-on="1"]{background:${INK};color:${PAPER};}

        @keyframes lcPrint{from{opacity:0;transform:translateY(-7px);}to{opacity:1;transform:none;}}
        @media (prefers-reduced-motion:reduce){.lc-hit{animation:none;}}
      `}</style>

      <div className="lc-wrap">
        <header>
          <div className="lc-eyebrow">동행복권 로또 6/45</div>
          <h1 className="lc-h1">이 번호, 언제 당첨됐나</h1>
          <p className="lc-sub">
            번호 6개를 고르면 역대 전 회차와 대조해 1·2·3등에 들었던 회차를 찾아 인쇄합니다.
          </p>
        </header>

        {/* 데이터 */}
        <div className="lc-bar">
          <div className="lc-status">
            {history.length ? (
              <>
                <b>{comma(history.length)}회차</b> 적재됨 · {span.dates}
                {isSample && <span className="lc-tag">샘플</span>}
              </>
            ) : booting ? (
              "회차 기록을 찾는 중..."
            ) : (
              "대조할 회차 기록이 없습니다. npm run fetch 를 실행하거나, 파일을 불러오세요."
            )}
          </div>
          <button className="lc-btn" onClick={() => fileRef.current?.click()}>
            기록 파일 불러오기
          </button>
          <button className="lc-btn" onClick={() => setPasteOpen((v) => !v)}>
            붙여넣기
          </button>
          <button className="lc-btn" onClick={loadSample}>
            샘플 넣기
          </button>
          <input ref={fileRef} type="file" accept=".json,.csv,.tsv,.txt" onChange={onFile} style={{ display: "none" }} />
        </div>

        {pasteOpen && (
          <div>
            <textarea
              className="lc-paste"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={'[{"drwNo":1,"drwNoDate":"2002-12-07","drwtNo1":10, ... ,"bnusNo":16}]\n또는\n1,2002-12-07,10,23,29,33,37,40,16'}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="lc-btn" onClick={() => loadText(pasteText, "붙여넣은 기록")}>
                이 내용으로 적재
              </button>
              <button className="lc-btn" onClick={() => setPasteText("")}>
                지우기
              </button>
            </div>
            <div className="lc-hint">
              동행복권 API 원본 JSON, {"{round, date, numbers[], bonus}"} 형식, CSV(회차·추첨일·번호6개·보너스) 모두 읽습니다.
            </div>
          </div>
        )}

        {error && <div className="lc-err">{error}</div>}

        <div className="lc-grid2">
          <div className="lc-col">
          {/* 마킹 용지 */}
          <section className="lc-paper lc-sheet">
            <div className="lc-sheet-head">
              <span>번호 선택</span>
              <span>{picked.length} / 6</span>
            </div>

            <div className="lc-cells">
              {Array.from({ length: 45 }, (_, i) => i + 1).map((n) => {
                const on = picked.includes(n);
                return (
                  <button
                    key={n}
                    className="lc-cell"
                    data-on={on ? "1" : "0"}
                    disabled={!on && picked.length >= 6}
                    onClick={() => toggle(n)}
                    aria-pressed={on}
                    aria-label={`${n}번`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>

            <div className="lc-slots">
              {Array.from({ length: 6 }, (_, i) =>
                picked[i] ? <Ball key={i} n={picked[i]} /> : <span key={i} className="lc-slot-empty" />
              )}
            </div>

            <input
              className="lc-input"
              value={manual}
              onChange={(e) => applyManual(e.target.value)}
              placeholder="직접 입력 — 예: 3 14 22 30 41 45"
              inputMode="numeric"
              aria-label="번호 직접 입력"
            />

            <div className="lc-mini">
              <button onClick={auto}>자동 선택</button>
              <button
                onClick={() => {
                  setPicked([]);
                  setManual("");
                  setResult(null);
                }}
              >
                전부 지우기
              </button>
            </div>

            <button className="lc-run" disabled={!ready} onClick={run}>
              {history.length === 0
                ? "먼저 회차 기록을 불러오세요"
                : picked.length < 6
                ? `번호 ${6 - picked.length}개 더 고르기`
                : "대조하기"}
            </button>
          </section>

          {/* 추천 조합 */}
          <section className="lc-paper lc-sheet lc-reco">
            <div className="lc-sheet-head">
              <span>추천 조합</span>
              <span>{reco.status === "ready" ? `4등 ${reco.minScore}회 이상` : "미탐색"}</span>
            </div>

            <div className="lc-reco-lead">
              1·2·3등에 든 적이 <b>한 번도 없으면서</b>
              <br />
              4등 이력이 가장 많은 조합을 찾습니다.
            </div>

            {reco.status === "ready" &&
              recos.map((r) => (
                <div key={r.numbers.join("-")} className="lc-reco-row">
                  <div className="lc-reco-balls">
                    {r.numbers.map((n) => (
                      <Ball key={n} n={n} size={28} />
                    ))}
                  </div>
                  <span className="lc-reco-n4">
                    4등 <b>{r.n4}</b>회
                  </span>
                  <button className="lc-reco-use" onClick={() => recall(r)}>
                    용지에 넣기
                  </button>
                </div>
              ))}

            {reco.status === "error" && <div className="lc-reco-foot">찾지 못했습니다. {reco.message}</div>}

            <button className="lc-reco-btn" disabled={!history.length || reco.status === "working"} onClick={drawRecos}>
              {!history.length
                ? "먼저 회차 기록을 불러오세요"
                : reco.status === "working"
                ? `전체 조합 훑는 중... ${Math.round(reco.progress * 100)}%`
                : reco.status === "ready"
                ? "다시 뽑기"
                : "추천 조합 뽑기"}
            </button>

            {reco.status === "working" && (
              <div className="lc-bar-progress">
                <i style={{ width: `${Math.round(reco.progress * 100)}%` }} />
              </div>
            )}

            {reco.status === "ready" && (
              <div className="lc-reco-foot">
                {comma(reco.draws)}회차 기준 · 1~3등 이력이 없는 조합 {comma(reco.eligible)}개 중 4등 이력 상위
                500개에서 무작위로 5조합을 뽑았습니다. 역대 최다는 4등 {reco.topScore}회.
                {reco.isSample && " ⚠ 샘플 데이터 기준"}
                <br />
                추첨은 매 회차 독립이라, 과거 이력이 많다고 앞으로 당첨될 확률이 높아지지는 않습니다.
              </div>
            )}
          </section>

          {/* 보관함 */}
          <section className="lc-paper lc-sheet lc-vault">
            <div className="lc-sheet-head">
              <span>보관함</span>
              <span>{saved.length}건</span>
            </div>

            {saved.length ? (
              <ul className="lc-vault-list">
                {saved.map((e) => (
                  <li key={e.id} className="lc-item">
                    <div className="lc-item-balls">
                      {e.numbers.map((n) => (
                        <Ball key={n} n={n} size={28} />
                      ))}
                    </div>
                    <div className="lc-item-meta">
                      {e.savedAt.slice(0, 10)} 저장 · {summaryLine(e.summary)}
                    </div>
                    <div className="lc-item-acts">
                      <button onClick={() => recall(e)}>불러오기</button>
                      <button onClick={() => commitSaved(removeAt(saved, e.id), "보관함에서 뺐습니다.")}>
                        삭제
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="lc-vault-empty">
                대조한 번호를 저장해두면 여기 쌓입니다.
                <br />
                결과 영수증의 «이 번호 저장» 을 누르세요.
              </div>
            )}

            <div className="lc-vault-foot">
              <button onClick={exportSaved} disabled={!saved.length}>
                내보내기
              </button>
              <button onClick={() => savedFileRef.current?.click()}>가져오기</button>
              <input
                ref={savedFileRef}
                type="file"
                accept=".json"
                onChange={onSavedFile}
                style={{ display: "none" }}
              />
            </div>

            {savedNote && <div className="lc-vault-note">{savedNote}</div>}
          </section>
          </div>

          {/* 영수증 */}
          <section className="lc-resultcol">
            <div className="lc-paper lc-receipt">
              <div className="lc-receipt-body">
                {!result ? (
                  <div className="lc-ghost">
                    번호 6개를 고르고 대조하면
                    <br />
                    이 자리에 결과가 인쇄됩니다.
                  </div>
                ) : (
                  <div key={printKey}>
                    <div className="lc-rhead">
                      <span>대조 결과</span>
                      <button
                        className="lc-save"
                        data-on={isSaved ? "1" : "0"}
                        onClick={toggleSave}
                        aria-pressed={isSaved}
                      >
                        {isSaved ? "저장됨 ✓" : "이 번호 저장"}
                      </button>
                    </div>

                    <Row label="내 번호" value={result.picked.map(pad).join(" ")} />
                    <Row label="대조 회차" value={`${comma(result.total)}회 (${span.rounds})`} />
                    <Row label="추첨일" value={span.dates} />
                    <Row label="기록" value={result.source + (result.isSample ? " ⚠" : "")} />

                    <div className="lc-cards">
                      {[1, 2, 3].map((r) => (
                        <div
                          key={r}
                          className="lc-card"
                          data-hit={result.counts[r] > 0 ? "1" : "0"}
                          style={result.counts[r] > 0 ? { borderColor: RANK_COLOR[r] } : undefined}
                        >
                          <span>{r}등</span>
                          <b style={result.counts[r] > 0 ? { color: INK } : undefined}>{result.counts[r]}</b>
                        </div>
                      ))}
                    </div>
                    <div className="lc-note">
                      그 밖에 4등 {comma(result.counts[4])}회 · 5등 {comma(result.counts[5])}회
                      {result.isSample && " · 샘플 데이터라 실제 당첨 기록이 아닙니다"}
                    </div>

                    <hr className="lc-sep" />

                    {hasWin ? (
                      <>
                        <div className="lc-secttl">당첨 회차 {result.hits.length}건</div>
                        {result.hits.map((h, i) => (
                          <div key={h.round} className="lc-hit" style={{ animationDelay: `${Math.min(i, 12) * 45}ms` }}>
                            <div className="lc-hitline">
                              <span className="lc-round">{comma(h.round)}회</span>
                              <span>{h.date || "날짜 없음"}</span>
                              <span className="lc-rank" style={{ background: RANK_COLOR[h.rank] }}>
                                {h.rank}등
                              </span>
                            </div>
                            <div className="lc-balls">
                              {h.numbers.map((n) => (
                                <Ball key={n} n={n} size={30} dim={!result.picked.includes(n)} />
                              ))}
                              <span className="lc-plus">+</span>
                              <Ball
                                n={h.bonus}
                                size={30}
                                dim={!h.bonusHit}
                                ring={h.bonusHit && h.rank === 2}
                              />
                            </div>
                            {h.rank === 1 && h.prize != null && (
                              <div className="lc-prize">
                                1등 {comma(h.prize)}원
                                {h.winners != null && ` · 당첨자 ${comma(h.winners)}명`}
                              </div>
                            )}
                          </div>
                        ))}
                      </>
                    ) : (
                      <>
                        <div className="lc-empty">
                          <h3>1~3등 이력 없음</h3>
                          <p>
                            {comma(result.total)}회차를 전부 대조했습니다.
                            <br />
                            가장 많이 맞은 건 {result.best}개이고, {comma(result.bestCount)}개 회차에서 나왔습니다.
                          </p>
                        </div>
                        {result.best >= 3 && (
                          <>
                            <div className="lc-secttl">가장 근접했던 회차</div>
                            {result.nearest.map((h, i) => (
                              <div key={h.round} className="lc-hit" style={{ animationDelay: `${i * 45}ms` }}>
                                <div className="lc-hitline">
                                  <span className="lc-round">{comma(h.round)}회</span>
                                  <span>{h.date || "날짜 없음"}</span>
                                  <span style={{ marginLeft: "auto" }}>{result.best}개 일치</span>
                                </div>
                                <div className="lc-balls">
                                  {h.numbers.map((n) => (
                                    <Ball key={n} n={n} size={30} dim={!result.picked.includes(n)} />
                                  ))}
                                  <span className="lc-plus">+</span>
                                  <Ball n={h.bonus} size={30} dim={!result.picked.includes(h.bonus)} />
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
              <TearEdge />
            </div>

            <div className="lc-hint">
              등수 기준 — 1등 6개 일치 · 2등 5개+보너스 · 3등 5개 · 4등 4개 · 5등 3개
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
