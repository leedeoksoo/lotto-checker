package io.github.leedeoksoo.lottochecker.alarm;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * 재부팅·앱 업데이트·정확한 알람 권한 변경 시 알람이 사라지거나 바뀌므로 다시 건다.
 * 꺼져 있던 동안 놓친 회차가 있으면 바로 확인한다.
 */
public class BootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        SavedStore store = new SavedStore(context);
        if (!store.enabled()) return;
        AlarmScheduler.scheduleWeekly(context);
        if (store.lastNotifiedRound() < DrawSchedule.expectedRound(System.currentTimeMillis())) {
            DrawCheckWorker.enqueue(context, false);
        }
    }
}
