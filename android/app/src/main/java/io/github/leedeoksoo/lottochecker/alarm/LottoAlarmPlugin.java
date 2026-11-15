package io.github.leedeoksoo.lottochecker.alarm;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/** 웹(src/drawAlarm.js) ↔ 네이티브 알림 기능 브리지. */
@CapacitorPlugin(
        name = "LottoAlarm",
        permissions = {@Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS})})
public class LottoAlarmPlugin extends Plugin {

    private SavedStore store;

    @Override
    public void load() {
        store = new SavedStore(getContext());
        // 강제 종료 등으로 알람이 지워졌을 수 있으니 앱을 열 때마다 다시 건다.
        if (store.enabled()) AlarmScheduler.scheduleWeekly(getContext());
    }

    @PluginMethod
    public void syncSaved(PluginCall call) {
        JSArray saved = call.getArray("saved");
        store.setSavedJson(saved == null ? "[]" : saved.toString());
        call.resolve();
    }

    @PluginMethod
    public void enable(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "afterNotifPermission");
            return;
        }
        doEnable(call);
    }

    @PermissionCallback
    private void afterNotifPermission(PluginCall call) {
        if (getPermissionState("notifications") != PermissionState.GRANTED) {
            call.resolve(status());
            return;
        }
        doEnable(call);
    }

    private void doEnable(PluginCall call) {
        Context c = getContext();
        long now = System.currentTimeMillis();
        int round = DrawSchedule.expectedRound(now);
        boolean tonight = DrawSchedule.inRetryWindow(now);
        // 이미 지난 회차는 알리지 않는다. 단 토 21:10~23:00 에 켜면 오늘 회차는 확인한다.
        int baseline = tonight ? round - 1 : round;
        if (store.lastNotifiedRound() < baseline) store.setLastNotifiedRound(baseline);
        store.setEnabled(true);
        AlarmScheduler.scheduleWeekly(c);
        if (tonight) DrawCheckWorker.enqueue(c, false);
        call.resolve(status());
    }

    @PluginMethod
    public void disable(PluginCall call) {
        store.setEnabled(false);
        AlarmScheduler.cancelAll(getContext());
        call.resolve(status());
    }

    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(status());
    }

    @PluginMethod
    public void checkNow(PluginCall call) {
        DrawCheckWorker.enqueue(getContext(), true);
        call.resolve();
    }

    @PluginMethod
    public void openExactAlarmSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            open(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getContext().getPackageName())));
        }
        call.resolve();
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        Intent i;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        } else {
            i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
        }
        open(i);
        call.resolve();
    }

    private void open(Intent i) {
        try {
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        } catch (Exception ignored) {
            // 제조사 설정 화면이 없는 경우
        }
    }

    private JSObject status() {
        Context c = getContext();
        JSObject o = new JSObject();
        o.put("supported", true);
        o.put("enabled", store.enabled());
        o.put("notifPermission", Notifier.allowed(c));
        o.put("exactAlarm", AlarmScheduler.canExact(c));
        o.put("nextAt", DrawSchedule.nextAlarm(System.currentTimeMillis()));
        return o;
    }
}
