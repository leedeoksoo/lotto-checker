package io.github.leedeoksoo.lottochecker.alarm;

import java.util.Calendar;
import java.util.TimeZone;

/**
 * 회차와 알람 시각 계산. 안드로이드에 의존하지 않는 순수 계산이라 JUnit 으로 바로 검증한다.
 *
 * <p>로또 6/45 는 2002-12-07 1회차부터 한 주도 거르지 않고 매주 토요일 추첨했다(1~1238회 확인).
 * 한국은 1988년 이후 서머타임이 없으므로 "확인 시각"은 1회차 토 21:10 KST 에서 정확히 7일 간격이다.
 * minSdk 24 라 java.time 대신 Calendar 를 쓴다.
 */
public final class DrawSchedule {

    public static final TimeZone KST = TimeZone.getTimeZone("Asia/Seoul");
    public static final long MINUTE = 60_000L;
    public static final long WEEK = 7L * 24 * 60 * MINUTE;
    /** 결과가 아직 없을 때 다시 시도하는 간격. */
    public static final long RETRY_INTERVAL = 10 * MINUTE;
    /** 21:10 확인부터 23:00 까지. */
    public static final long RETRY_SPAN = 110 * MINUTE;

    /** 1회차 확인 시각: 2002-12-07 21:10 KST. */
    public static final long FIRST_CHECK = firstCheck();

    private DrawSchedule() {}

    private static long firstCheck() {
        Calendar c = Calendar.getInstance(KST);
        c.clear();
        c.set(2002, Calendar.DECEMBER, 7, 21, 10, 0);
        return c.getTimeInMillis();
    }

    /** now 시점에 결과가 나와 있어야 하는 가장 최근 회차. 1회차 확인 전이면 0. */
    public static int expectedRound(long now) {
        if (now < FIRST_CHECK) return 0;
        return (int) ((now - FIRST_CHECK) / WEEK) + 1;
    }

    /** 해당 회차를 확인하는 토요일 21:10 KST. */
    public static long checkTimeOf(int round) {
        return FIRST_CHECK + (round - 1L) * WEEK;
    }

    /** now 보다 엄격히 뒤인 다음 토요일 21:10 KST. */
    public static long nextAlarm(long now) {
        return checkTimeOf(expectedRound(now) + 1);
    }

    /** 이 회차를 다시 시도할 수 있는 마지막 시각(토 23:00 KST). */
    public static long retryDeadline(int round) {
        return checkTimeOf(round) + RETRY_SPAN;
    }

    /** 지금이 토 21:10~23:00 사이인지. */
    public static boolean inRetryWindow(long now) {
        int round = expectedRound(now);
        return round > 0 && now <= retryDeadline(round);
    }
}
