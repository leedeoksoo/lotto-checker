package io.github.leedeoksoo.lottochecker.alarm;

import static org.junit.Assert.assertEquals;

import java.util.Calendar;
import java.util.TimeZone;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;

public class DrawScheduleTest {

    private TimeZone saved;

    @Before
    public void setUp() {
        saved = TimeZone.getDefault();
        // 기기 시간대가 한국이 아니어도 계산이 KST 기준이어야 한다.
        TimeZone.setDefault(TimeZone.getTimeZone("America/Los_Angeles"));
    }

    @After
    public void tearDown() {
        TimeZone.setDefault(saved);
    }

    private static long kst(int y, int m, int d, int hh, int mm) {
        Calendar c = Calendar.getInstance(TimeZone.getTimeZone("Asia/Seoul"));
        c.clear();
        c.set(y, m - 1, d, hh, mm, 0);
        return c.getTimeInMillis();
    }

    @Test
    public void firstRoundStartsAtFirstCheck() {
        assertEquals(0, DrawSchedule.expectedRound(kst(2002, 12, 7, 21, 9)));
        assertEquals(1, DrawSchedule.expectedRound(kst(2002, 12, 7, 21, 10)));
    }

    @Test
    public void knownRound() {
        // 1238회 = 2026-08-22 (lotto_history.json 마지막 회차)
        assertEquals(1237, DrawSchedule.expectedRound(kst(2026, 8, 22, 21, 9)));
        assertEquals(1238, DrawSchedule.expectedRound(kst(2026, 8, 22, 21, 10)));
        assertEquals(1238, DrawSchedule.expectedRound(kst(2026, 8, 29, 21, 9)));
    }

    @Test
    public void sundayBelongsToPreviousSaturday() {
        assertEquals(1250, DrawSchedule.expectedRound(kst(2026, 11, 15, 12, 0)));
    }

    @Test
    public void nextAlarmIsComingSaturday() {
        assertEquals(kst(2026, 11, 21, 21, 10), DrawSchedule.nextAlarm(kst(2026, 11, 15, 12, 0)));
        assertEquals(kst(2026, 11, 21, 21, 10), DrawSchedule.nextAlarm(kst(2026, 11, 21, 21, 9)));
    }

    @Test
    public void nextAlarmAtExactTimeMovesToNextWeek() {
        assertEquals(kst(2026, 11, 28, 21, 10), DrawSchedule.nextAlarm(kst(2026, 11, 21, 21, 10)));
    }

    @Test
    public void nextAlarmAcrossYearEnd() {
        assertEquals(kst(2027, 1, 2, 21, 10), DrawSchedule.nextAlarm(kst(2026, 12, 27, 9, 0)));
    }

    @Test
    public void retryDeadlineIs2300() {
        int round = DrawSchedule.expectedRound(kst(2026, 11, 21, 21, 10));
        assertEquals(kst(2026, 11, 21, 23, 0), DrawSchedule.retryDeadline(round));
    }

    @Test
    public void withinRetryWindow() {
        assertEquals(true, DrawSchedule.inRetryWindow(kst(2026, 11, 21, 21, 30)));
        assertEquals(false, DrawSchedule.inRetryWindow(kst(2026, 11, 21, 23, 1)));
        assertEquals(false, DrawSchedule.inRetryWindow(kst(2026, 11, 21, 21, 0)));
    }
}
