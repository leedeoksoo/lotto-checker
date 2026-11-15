package io.github.leedeoksoo.lottochecker.alarm;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * 동행복권 당첨번호 조회. scripts/fetch_lotto_history.py 와 같은 엔드포인트·헤더를 쓴다.
 * 네이티브 요청이라 웹뷰의 CORS 제약을 받지 않는다.
 */
final class LottoApi {

    static final String API = "https://www.dhlottery.co.kr/lt645/selectPstLt645InfoNew.do";
    static final String REFERER = "https://www.dhlottery.co.kr/lt645/result";
    static final String UA =
            "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
    static final int TIMEOUT_MS = 15_000;

    static final class Draw {
        final int[] numbers;
        final int bonus;

        Draw(int[] numbers, int bonus) {
            this.numbers = numbers;
            this.bonus = bonus;
        }
    }

    private LottoApi() {}

    /** 해당 회차가 아직 없으면 null. 네트워크·형식 오류는 예외. */
    static Draw fetch(int round) throws IOException, JSONException {
        JSONArray list = window(round);
        for (int i = 0; i < list.length(); i++) {
            JSONObject item = list.getJSONObject(i);
            if (item.optInt("ltEpsd", -1) != round) continue;
            int[] ns = new int[6];
            for (int k = 0; k < 6; k++) ns[k] = item.getInt("tm" + (k + 1) + "WnNo");
            return new Draw(ns, item.getInt("bnsWnNo"));
        }
        return null;
    }

    /**
     * from~to 회차를 lotto_history.json 과 같은 형식(drwNo, drwNoDate, drwtNo1~6, bnusNo …)으로 받는다.
     * center 조회는 anchor-5 ~ anchor+4 의 10회차를 돌려주므로 10회차 단위로 묶어 요청한다.
     * 아직 추첨 전인 회차는 결과에 없다.
     */
    static JSONArray fetchRange(int from, int to) throws IOException, JSONException {
        java.util.TreeMap<Integer, JSONObject> rows = new java.util.TreeMap<>();
        java.util.TreeSet<Integer> anchors = new java.util.TreeSet<>();
        for (int n = from; n <= to; n++) anchors.add(Math.min(Math.max(10 * ((n + 5) / 10), 5), to));
        for (int anchor : anchors) {
            JSONArray list = window(anchor);
            for (int i = 0; i < list.length(); i++) {
                JSONObject item = list.getJSONObject(i);
                int no = item.optInt("ltEpsd", -1);
                if (no >= from && no <= to) rows.put(no, convert(item));
            }
        }
        JSONArray out = new JSONArray();
        for (JSONObject r : rows.values()) out.put(r);
        return out;
    }

    /** scripts/fetch_lotto_history.py 의 convert() 와 같은 변환. */
    static JSONObject convert(JSONObject item) throws JSONException {
        String ymd = item.optString("ltRflYmd", "");
        String date = ymd.length() == 8 ? ymd.substring(0, 4) + "-" + ymd.substring(4, 6) + "-" + ymd.substring(6, 8) : ymd;
        JSONObject r = new JSONObject();
        r.put("drwNo", item.getInt("ltEpsd"));
        r.put("drwNoDate", date);
        r.put("bnusNo", item.getInt("bnsWnNo"));
        r.put("firstWinamnt", item.opt("rnk1WnAmt"));
        r.put("firstPrzwnerCo", item.opt("rnk1WnNope"));
        r.put("totSellamnt", item.opt("wholEpsdSumNtslAmt"));
        for (int k = 1; k <= 6; k++) r.put("drwtNo" + k, item.getInt("tm" + k + "WnNo"));
        return r;
    }

    /** anchor 를 중심으로 한 10회차 묶음의 원본 목록. 비어 있을 수 있다. */
    private static JSONArray window(int anchor) throws IOException, JSONException {
        URL url = new URL(API + "?srchDir=center&srchLtEpsd=" + anchor);
        HttpURLConnection con = (HttpURLConnection) url.openConnection();
        con.setConnectTimeout(TIMEOUT_MS);
        con.setReadTimeout(TIMEOUT_MS);
        con.setRequestProperty("User-Agent", UA);
        con.setRequestProperty("Accept", "application/json");
        con.setRequestProperty("Referer", REFERER);
        try {
            int code = con.getResponseCode();
            if (code != HttpURLConnection.HTTP_OK) throw new IOException("HTTP " + code);
            String body;
            try (InputStream in = con.getInputStream()) {
                body = read(in);
            }
            JSONObject data = new JSONObject(body).optJSONObject("data");
            JSONArray list = data == null ? null : data.optJSONArray("list");
            return list == null ? new JSONArray() : list;
        } finally {
            con.disconnect();
        }
    }

    private static String read(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
        return new String(out.toByteArray(), StandardCharsets.UTF_8);
    }
}
