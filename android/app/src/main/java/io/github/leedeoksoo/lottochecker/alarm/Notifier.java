package io.github.leedeoksoo.lottochecker.alarm;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import io.github.leedeoksoo.lottochecker.R;

/** 결과 알림 채널과 표시. */
final class Notifier {

    static final String CHANNEL = "draw_result";

    private Notifier() {}

    static void ensureChannel(Context c) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel ch =
                new NotificationChannel(CHANNEL, "당첨 결과", NotificationManager.IMPORTANCE_DEFAULT);
        ch.setDescription("토요일 저녁 저장 번호 대조 결과");
        c.getSystemService(NotificationManager.class).createNotificationChannel(ch);
    }

    /** 알림이 실제로 보일 수 있는지 (권한 + 앱 알림 스위치). */
    static boolean allowed(Context c) {
        if (Build.VERSION.SDK_INT >= 33
                && ContextCompat.checkSelfPermission(c, Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
            return false;
        }
        return NotificationManagerCompat.from(c).areNotificationsEnabled();
    }

    static void show(Context c, ResultMessage m) {
        if (!allowed(c)) return;
        ensureChannel(c);

        Intent open = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        PendingIntent tap =
                open == null
                        ? null
                        : PendingIntent.getActivity(
                                c, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder b =
                new NotificationCompat.Builder(c, CHANNEL)
                        .setSmallIcon(R.drawable.ic_stat_lotto)
                        .setContentTitle(m.title)
                        .setContentText(m.text)
                        .setAutoCancel(true)
                        .setPriority(NotificationCompat.PRIORITY_DEFAULT);
        if (tap != null) b.setContentIntent(tap);

        if (m.lines.isEmpty()) {
            b.setStyle(new NotificationCompat.BigTextStyle().bigText(m.text));
        } else {
            NotificationCompat.InboxStyle s = new NotificationCompat.InboxStyle().setBigContentTitle(m.title);
            s.addLine(m.text);
            for (String line : m.lines) s.addLine(line);
            b.setStyle(s);
        }

        try {
            // 같은 회차의 실패 알림은 성공 알림으로 덮어쓴다.
            NotificationManagerCompat.from(c).notify(m.round, b.build());
        } catch (SecurityException ignored) {
            // 알림 권한이 그 사이 회수된 경우
        }
    }
}
