package kr.doran;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.*;
import com.google.firebase.messaging.*;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import jakarta.annotation.PreDestroy;
import java.util.concurrent.*;
import java.nio.file.*;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
@Service
public class PushService {
    private static final org.slf4j.Logger log=org.slf4j.LoggerFactory.getLogger(PushService.class);
    private final JdbcTemplate db;
    private final FirebaseApp app;
    private final ThreadPoolExecutor executor=new ThreadPoolExecutor(1,1,30,TimeUnit.SECONDS,new ArrayBlockingQueue<>(100));
    PushService(JdbcTemplate db, @Value("${PUSH_ENABLED:false}") boolean enabled,
                @Value("${GOOGLE_APPLICATION_CREDENTIALS:}") String credentials) throws Exception {
        this.db=db;
        if(enabled) {
            try(var input=Files.newInputStream(Path.of(credentials))) {
                app=FirebaseApp.initializeApp(FirebaseOptions.builder().setCredentials(GoogleCredentials.fromStream(input)).build(), "nirangnae");
            }
        } else app=null;
        executor.allowCoreThreadTimeOut(true);
    }
    boolean enabled() { return app!=null; }
    static String hash(String token) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8))); }
        catch(Exception e) { throw new IllegalStateException(e); }
    }
    void register(long user,String session,String token) {
        // A refreshed token replaces this session's previous token.
        db.update("delete from push_devices where session_id=?",session);
        db.update("insert into push_devices(token_hash,token,usr,session_id) values(?,?,?,?) on conflict(token_hash) do update set usr=excluded.usr, session_id=excluded.session_id, updated_at=now()",hash(token),token,user,session);
    }
    void unregisterSession(String session) { db.update("delete from push_devices where session_id=?",session); }
    void notifyRoom(long room,long sender) {
        if(app==null) return;
        try { executor.execute(() -> deliver(room,sender)); }
        catch(RejectedExecutionException e) { log.warn("Push queue full; messages remain available through history"); }
    }
    private void deliver(long room,long sender) {
        try {
            var devices=db.queryForList("select d.token_hash,d.token from push_devices d join members m on m.usr=d.usr join spring_session s on s.session_id=d.session_id where m.room=? and d.usr<>? and s.expiry_time>?",room,sender,System.currentTimeMillis());
            for(var d:devices) {
                try {
                    FirebaseMessaging.getInstance(app).send(Message.builder().setToken((String)d.get("token"))
                        .setNotification(Notification.builder().setTitle("니랑내").setBody("새 메시지가 도착했습니다").build())
                        .putData("room",Long.toString(room))
                        .setAndroidConfig(AndroidConfig.builder().setPriority(AndroidConfig.Priority.HIGH).setTtl(3600000)
                            .setNotification(AndroidNotification.builder().setChannelId("messages").setTag("room-"+room).build()).build()).build());
                } catch(FirebaseMessagingException e) {
                    if(e.getMessagingErrorCode()==MessagingErrorCode.UNREGISTERED)
                        db.update("delete from push_devices where token_hash=?",d.get("token_hash"));
                    // Do not log exception text: provider errors may contain a device token.
                    log.warn("Push delivery failed: {}",e.getMessagingErrorCode());
                }
            }
        } catch(Exception e) { log.warn("Push delivery unavailable: {}",e.getClass().getSimpleName()); }
    }
    @PreDestroy void close() { executor.shutdownNow(); if(app!=null) app.delete(); }
}
