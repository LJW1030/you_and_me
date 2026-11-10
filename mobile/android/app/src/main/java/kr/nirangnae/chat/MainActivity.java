package kr.nirangnae.chat;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel("messages", "새 메시지", NotificationManager.IMPORTANCE_HIGH);
            channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PRIVATE);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }
}
