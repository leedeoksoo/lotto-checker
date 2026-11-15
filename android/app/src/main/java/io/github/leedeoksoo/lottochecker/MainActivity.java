package io.github.leedeoksoo.lottochecker;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import io.github.leedeoksoo.lottochecker.alarm.LottoAlarmPlugin;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 앱 안 플러그인은 super.onCreate 전에 등록해야 브리지가 인식한다.
        registerPlugin(LottoAlarmPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
