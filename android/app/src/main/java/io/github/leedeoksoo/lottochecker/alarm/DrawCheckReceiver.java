package io.github.leedeoksoo.lottochecker.alarm;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** 알람 수신. 네트워크 작업은 Worker 로 넘기고, 주간 알람이면 다음 주 것을 건다. */
public class DrawCheckReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!new SavedStore(context).enabled()) return;
        if (AlarmScheduler.ACTION_WEEKLY.equals(intent.getAction())) {
            AlarmScheduler.scheduleWeekly(context);
        }
        DrawCheckWorker.enqueue(context, false);
    }
}
