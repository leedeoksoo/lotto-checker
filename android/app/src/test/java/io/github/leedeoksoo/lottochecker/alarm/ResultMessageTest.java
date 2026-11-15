package io.github.leedeoksoo.lottochecker.alarm;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.junit.Test;

public class ResultMessageTest {

    private static final int[] WIN = {3, 14, 22, 30, 41, 45};
    private static final int BONUS = 7;

    private static List<int[]> list(int[]... xs) {
        return new ArrayList<>(Arrays.asList(xs));
    }

    @Test
    public void allMiss() {
        ResultMessage m = ResultMessage.build(1198, list(new int[] {1, 2, 4, 5, 6, 8}, new int[] {9, 10, 11, 12, 13, 15}), WIN, BONUS);
        assertEquals("1,198회 당첨 결과", m.title);
        assertEquals("저장 2개 모두 낙첨 · 당첨번호 3 14 22 30 41 45 + 7", m.text);
        assertTrue(m.lines.isEmpty());
    }

    @Test
    public void hitsSummaryAndLinesSortedByRank() {
        ResultMessage m = ResultMessage.build(
                1198,
                list(
                        new int[] {3, 14, 22, 1, 2, 4}, // 5등
                        new int[] {1, 2, 4, 5, 6, 8}, // 낙첨
                        new int[] {30, 3, 14, 22, 2, 4}, // 4등 (정렬돼서 표시)
                        new int[] {3, 14, 41, 1, 2, 4}), // 5등
                WIN,
                BONUS);
        assertEquals("1,198회 당첨 결과", m.title);
        assertEquals("저장 4개 중 4등 1개 · 5등 2개", m.text);
        assertEquals(
                Arrays.asList(
                        "4등  2 · 3 · 4 · 14 · 22 · 30",
                        "5등  1 · 2 · 3 · 4 · 14 · 22",
                        "5등  1 · 2 · 3 · 4 · 14 · 41"),
                m.lines);
    }

    @Test
    public void topRanksGetCelebration() {
        ResultMessage m = ResultMessage.build(1198, list(new int[] {3, 14, 22, 30, 41, 7}), WIN, BONUS);
        assertEquals("🎉 1,198회 당첨 결과", m.title);
        assertEquals("저장 1개 중 2등 1개", m.text);
    }

    @Test
    public void atMostFiveLines() {
        List<int[]> xs = new ArrayList<>();
        for (int i = 0; i < 7; i++) xs.add(new int[] {3, 14, 22, 1, 2, 4 + i});
        ResultMessage m = ResultMessage.build(5, xs, WIN, BONUS);
        assertEquals(5, m.lines.size());
        assertEquals("5회 당첨 결과", m.title);
    }

    @Test
    public void failureAndEmpty() {
        assertEquals("1,198회 결과를 가져오지 못했어요. 앱에서 확인해 주세요.", ResultMessage.failure(1198).text);
        assertEquals("보관함에 저장한 번호가 없어요.", ResultMessage.empty(1198).text);
    }
}
