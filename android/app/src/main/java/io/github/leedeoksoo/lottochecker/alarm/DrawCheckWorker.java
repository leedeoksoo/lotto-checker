package io.github.leedeoksoo.lottochecker.alarm;

import android.content.Context;
import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.Data;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import java.util.List;

/**
 * 최신 회차 조회 → 저장 번호 대조 → 알림.
 * 결과가 아직 없거나 실패하면 토 23:00 까지 10분 간격으로 재시도 알람을 건다.
 */
public class DrawCheckWorker extends Worker {

    static final String UNIQUE = "draw-check";
    static final String KEY_FORCE = "force";

    public DrawCheckWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    /** force = 지금 확인 버튼. 이미 알린 회차여도, 시각과 무관하게 한 번 확인하고 알린다. */
    public static void enqueue(Context c, boolean force) {
        OneTimeWorkRequest req =
                new OneTimeWorkRequest.Builder(DrawCheckWorker.class)
                        .setConstraints(
                                new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                        .setInputData(new Data.Builder().putBoolean(KEY_FORCE, force).build())
                        .build();
        WorkManager.getInstance(c)
                .enqueueUniqueWork(UNIQUE, force ? ExistingWorkPolicy.REPLACE : ExistingWorkPolicy.KEEP, req);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context c = getApplicationContext();
        SavedStore store = new SavedStore(c);
        boolean force = getInputData().getBoolean(KEY_FORCE, false);
        long now = System.currentTimeMillis();
        int round = DrawSchedule.expectedRound(now);

        if (!force && (!store.enabled() || round <= store.lastNotifiedRound())) return Result.success();

        List<int[]> saved = store.saved();
        if (saved.isEmpty()) {
            if (force) Notifier.show(c, ResultMessage.empty(round));
            return Result.success();
        }

        LottoApi.Draw draw;
        try {
            draw = LottoApi.fetch(round);
        } catch (Exception e) {
            draw = null;
        }

        if (draw == null) {
            long retryAt = now + DrawSchedule.RETRY_INTERVAL;
            if (!force && retryAt <= DrawSchedule.retryDeadline(round)) {
                AlarmScheduler.scheduleRetry(c, retryAt);
            } else {
                // 마지막 처리 회차는 갱신하지 않는다 → 재부팅 시 보충 확인 대상으로 남음.
                Notifier.show(c, ResultMessage.failure(round));
            }
            return Result.success();
        }

        Notifier.show(c, ResultMessage.build(round, saved, draw.numbers, draw.bonus));
        if (round > store.lastNotifiedRound()) store.setLastNotifiedRound(round);
        return Result.success();
    }
}
