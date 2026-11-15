package io.github.leedeoksoo.lottochecker.alarm;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/**
 * 주간 알람(토 21:10)과 재시도 알람 등록. 알람은 한 번씩만 걸고, 울릴 때마다 다음 것을 새로 건다.
 * 정확한 알람 권한이 없으면 10분 창(setWindow)으로 대신한다.
 */
public final class AlarmScheduler {

    static final String ACTION_WEEKLY = "io.github.leedeoksoo.lottochecker.alarm.WEEKLY";
    static final String ACTION_RETRY = "io.github.leedeoksoo.lottochecker.alarm.RETRY";
    private static final int REQ_WEEKLY = 1;
    private static final int REQ_RETRY = 2;
    private static final long WINDOW = 10 * DrawSchedule.MINUTE;

    private AlarmScheduler() {}

    private static AlarmManager am(Context c) {
        return (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
    }

    public static boolean canExact(Context c) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;
        return am(c).canScheduleExactAlarms();
    }

    private static PendingIntent pending(Context c, int req, String action) {
        Intent i = new Intent(c, DrawCheckReceiver.class).setAction(action);
        return PendingIntent.getBroadcast(c, req, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** 다음 토요일 21:10 KST 로 주간 알람을 (다시) 건다. 반환값은 그 시각. */
    public static long scheduleWeekly(Context c) {
        long at = DrawSchedule.nextAlarm(System.currentTimeMillis());
        set(c, at, pending(c, REQ_WEEKLY, ACTION_WEEKLY));
        return at;
    }

    public static void scheduleRetry(Context c, long at) {
        set(c, at, pending(c, REQ_RETRY, ACTION_RETRY));
    }

    public static void cancelAll(Context c) {
        am(c).cancel(pending(c, REQ_WEEKLY, ACTION_WEEKLY));
        am(c).cancel(pending(c, REQ_RETRY, ACTION_RETRY));
    }

    private static void set(Context c, long at, PendingIntent p) {
        AlarmManager am = am(c);
        if (canExact(c)) {
            try {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, p);
                return;
            } catch (SecurityException ignored) {
                // 확인 직후 권한이 회수된 경우 아래로
            }
        }
        am.setWindow(AlarmManager.RTC_WAKEUP, at, WINDOW, p);
    }
}
