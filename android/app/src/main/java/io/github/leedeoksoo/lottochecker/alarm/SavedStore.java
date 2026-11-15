package io.github.leedeoksoo.lottochecker.alarm;

import android.content.Context;
import android.content.SharedPreferences;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONException;

/**
 * 보관함 번호의 네이티브 사본과 알림 설정.
 *
 * <p>원본은 웹뷰 localStorage(lc.saved.v1)이고, 앱이 바뀔 때마다 syncSaved 로 여기에 덮어쓴다.
 * 백그라운드 Worker 는 웹뷰를 띄우지 않고 이 사본만 읽는다.
 */
public final class SavedStore {

    private static final String PREFS = "lotto_alarm";
    private static final String KEY_SAVED = "saved";
    private static final String KEY_ENABLED = "enabled";
    /** 이미 처리한(알렸거나 기준점으로 삼은) 마지막 회차. */
    private static final String KEY_LAST_ROUND = "lastNotifiedRound";

    private final SharedPreferences prefs;

    public SavedStore(Context context) {
        prefs = context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public void setSavedJson(String json) {
        prefs.edit().putString(KEY_SAVED, json).apply();
    }

    /** 유효한 6개 번호 조합만 돌려준다. 손상된 값이면 빈 목록. */
    public List<int[]> saved() {
        List<int[]> out = new ArrayList<>();
        try {
            JSONArray arr = new JSONArray(prefs.getString(KEY_SAVED, "[]"));
            for (int i = 0; i < arr.length(); i++) {
                JSONArray ns = arr.optJSONArray(i);
                if (ns == null || ns.length() != 6) continue;
                int[] pick = new int[6];
                Set<Integer> seen = new HashSet<>();
                boolean ok = true;
                for (int j = 0; j < 6; j++) {
                    int n = ns.optInt(j, 0);
                    if (n < 1 || n > 45 || !seen.add(n)) {
                        ok = false;
                        break;
                    }
                    pick[j] = n;
                }
                if (ok) out.add(pick);
            }
        } catch (JSONException e) {
            return new ArrayList<>();
        }
        return out;
    }

    public boolean enabled() {
        return prefs.getBoolean(KEY_ENABLED, false);
    }

    public void setEnabled(boolean on) {
        prefs.edit().putBoolean(KEY_ENABLED, on).apply();
    }

    public int lastNotifiedRound() {
        return prefs.getInt(KEY_LAST_ROUND, 0);
    }

    public void setLastNotifiedRound(int round) {
        prefs.edit().putInt(KEY_LAST_ROUND, round).apply();
    }
}
