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
        URL url = new URL(API + "?srchDir=center&srchLtEpsd=" + round);
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
            if (list == null) return null;
            for (int i = 0; i < list.length(); i++) {
                JSONObject item = list.getJSONObject(i);
                if (item.optInt("ltEpsd", -1) != round) continue;
                int[] ns = new int[6];
                for (int k = 0; k < 6; k++) ns[k] = item.getInt("tm" + (k + 1) + "WnNo");
                return new Draw(ns, item.getInt("bnsWnNo"));
            }
            return null;
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
