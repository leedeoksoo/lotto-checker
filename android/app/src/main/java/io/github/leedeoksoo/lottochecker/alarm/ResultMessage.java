package io.github.leedeoksoo.lottochecker.alarm;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

/** 알림에 들어갈 문구. 순수 클래스라 JUnit 으로 바로 검증한다. */
public final class ResultMessage {

    public static final int MAX_LINES = 5;

    public final int round;
    public final String title;
    public final String text;
    /** 알림을 펼쳤을 때 보이는 당첨 조합 줄(높은 등수 순, 최대 5줄). */
    public final List<String> lines;

    private ResultMessage(int round, String title, String text, List<String> lines) {
        this.round = round;
        this.title = title;
        this.text = text;
        this.lines = Collections.unmodifiableList(lines);
    }

    static String num(int n) {
        return String.format(Locale.US, "%,d", n);
    }

    private static String joined(int[] ns, String sep) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < ns.length; i++) {
            if (i > 0) sb.append(sep);
            sb.append(ns[i]);
        }
        return sb.toString();
    }

    public static ResultMessage build(int round, List<int[]> saved, int[] win, int bonus) {
        int[] counts = new int[6];
        List<int[]> hits = new ArrayList<>(); // {rank, n1..n6}
        for (int[] pick : saved) {
            int r = RankCalc.rank(pick, win, bonus);
            counts[r]++;
            if (r > 0) {
                int[] sorted = pick.clone();
                Arrays.sort(sorted);
                int[] row = new int[7];
                row[0] = r;
                System.arraycopy(sorted, 0, row, 1, 6);
                hits.add(row);
            }
        }

        String title = num(round) + "회 당첨 결과";
        if (counts[1] + counts[2] > 0) title = "🎉 " + title;

        String text;
        if (hits.isEmpty()) {
            int[] w = win.clone();
            Arrays.sort(w);
            text = "저장 " + saved.size() + "개 모두 낙첨 · 당첨번호 " + joined(w, " ") + " + " + bonus;
        } else {
            StringBuilder sb = new StringBuilder("저장 ").append(saved.size()).append("개 중 ");
            boolean first = true;
            for (int r = 1; r <= 5; r++) {
                if (counts[r] == 0) continue;
                if (!first) sb.append(" · ");
                sb.append(r).append("등 ").append(counts[r]).append("개");
                first = false;
            }
            text = sb.toString();
        }

        // 등수가 같으면 원래 순서(보관함 순서)를 유지한다. List.sort 는 안정 정렬이다.
        hits.sort((a, b) -> Integer.compare(a[0], b[0]));
        List<String> lines = new ArrayList<>();
        for (int[] row : hits) {
            if (lines.size() == MAX_LINES) break;
            lines.add(row[0] + "등  " + joined(Arrays.copyOfRange(row, 1, 7), " · "));
        }
        return new ResultMessage(round, title, text, lines);
    }

    public static ResultMessage failure(int round) {
        return new ResultMessage(
                round, num(round) + "회 당첨 결과", num(round) + "회 결과를 가져오지 못했어요. 앱에서 확인해 주세요.", new ArrayList<>());
    }

    public static ResultMessage empty(int round) {
        return new ResultMessage(round, num(round) + "회 당첨 결과", "보관함에 저장한 번호가 없어요.", new ArrayList<>());
    }
}
