package kr.doran;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.*;
import com.google.firebase.messaging.*;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import jakarta.annotation.PreDestroy;
import java.nio.file.*;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;

@Service
@EnableScheduling
public class PushService {
    private static final org.slf4j.Logger log=org.slf4j.LoggerFactory.getLogger(PushService.class);
    private final JdbcTemplate db;
    private final TransactionTemplate tx;
    private final FirebaseApp app;
    @org.springframework.beans.factory.annotation.Autowired
    PushService(JdbcTemplate db, TransactionTemplate tx, @Value("${PUSH_ENABLED:false}") boolean enabled,
                @Value("${GOOGLE_APPLICATION_CREDENTIALS:}") String credentials) throws Exception {
        this.db=db; this.tx=tx;
        if(enabled) {
            try(var input=Files.newInputStream(Path.of(credentials))) {
                app=FirebaseApp.initializeApp(FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(input))
                    .setConnectTimeout(5000).setReadTimeout(10000).build(), "nirangnae");
            }
        } else app=null;
    }
    PushService(JdbcTemplate db, TransactionTemplate tx, FirebaseApp app) { this.db=db; this.tx=tx; this.app=app; }
    boolean enabled() { return app!=null; }
    static String hash(String token) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8))); }
        catch(Exception e) { throw new IllegalStateException(e); }
    }
    void register(long user,String session,String token) {
        // Preserve pending jobs on an unchanged token; rotation removes only the old token.
        db.update("delete from push_devices where session_id=? and token_hash<>?",session,hash(token));
        db.update("insert into push_devices(token_hash,token,usr,session_id) values(?,?,?,?) on conflict(token_hash) do update set usr=excluded.usr, session_id=excluded.session_id, updated_at=now()",hash(token),token,user,session);
    }
    boolean registered(String session) {
        return db.queryForObject("select count(*) from push_devices where session_id=?",Integer.class,session)>0;
    }
    void unregisterSession(String session) { db.update("delete from push_devices where session_id=?",session); }
    void enqueue(long room,long seq,long sender) {
        if(!enabled()) return;
        db.update("""
            insert into push_outbox(room,seq,token_hash,recipient,session_id)
            select ?,?,d.token_hash,d.usr,d.session_id from push_devices d
            join members m on m.usr=d.usr and m.room=?
            join spring_session s on s.session_id=d.session_id
            where d.usr<>? and s.expiry_time>?
            on conflict(room,seq,token_hash) do nothing
            """,room,seq,room,sender,System.currentTimeMillis());
    }
    static long retrySeconds(int attempt) { return Math.min(3600,30L << Math.min(attempt,7)); }
    static boolean retryable(MessagingErrorCode code) {
        return code==MessagingErrorCode.UNAVAILABLE || code==MessagingErrorCode.INTERNAL || code==MessagingErrorCode.QUOTA_EXCEEDED;
    }
    static Message notification(String token,long room,long seq) {
        return Message.builder().setToken(token)
            .setNotification(Notification.builder().setTitle("니랑내").setBody("새 메시지가 도착했습니다").build())
            .putData("room",Long.toString(room)).putData("seq",Long.toString(seq))
            .setAndroidConfig(AndroidConfig.builder().setPriority(AndroidConfig.Priority.HIGH).setTtl(3600000)
                .setNotification(AndroidNotification.builder().setChannelId("messages").setTag("room-"+room)
                    .setVisibility(AndroidNotification.Visibility.PRIVATE).build()).build()).build();
    }
    // This processes actual pending work; it never calls the public site to keep it awake.
    @Scheduled(fixedDelayString="${PUSH_POLL_MS:15000}",initialDelay=15000)
    void drain() {
        if(!enabled()) return;
        try {
            for(int n=0;n<5;n++) {
                Boolean processed=tx.execute(status -> {
                    var rows=db.queryForList("select * from push_outbox where available_at<=now() order by available_at,id for update skip locked limit 1");
                    if(rows.isEmpty()) return false;
                    var job=rows.get(0); long id=((Number)job.get("id")).longValue();
                    // Token reassignment, logout, session expiry, leaving or reading a room cancels stale work.
                    var devices=db.queryForList("""
                        select d.token from push_devices d
                        join spring_session s on s.session_id=d.session_id
                        join members m on m.usr=d.usr and m.room=?
                        where d.token_hash=? and d.usr=? and d.session_id=? and s.expiry_time>?
                        and m.last_read<? and ?::timestamptz>now()-interval '1 day'
                        """,job.get("room"),job.get("token_hash"),job.get("recipient"),job.get("session_id"),System.currentTimeMillis(),job.get("seq"),job.get("created_at"));
                    if(devices.isEmpty()) { db.update("delete from push_outbox where id=?",id); return true; }
                    try {
                        FirebaseMessaging.getInstance(app).send(notification((String)devices.get(0).get("token"),((Number)job.get("room")).longValue(),((Number)job.get("seq")).longValue()));
                        db.update("delete from push_outbox where id=?",id);
                        log.info("Push accepted by FCM job={}",id); // Not proof of device receipt.
                    } catch(FirebaseMessagingException e) {
                        int attempt=((Number)job.get("attempts")).intValue()+1;
                        if(e.getMessagingErrorCode()==MessagingErrorCode.UNREGISTERED) {
                            db.update("delete from push_devices where token_hash=? and usr=? and session_id=?",job.get("token_hash"),job.get("recipient"),job.get("session_id"));
                            db.update("delete from push_outbox where id=?",id);
                        } else if(retryable(e.getMessagingErrorCode()) && attempt<8) {
                            db.update("update push_outbox set attempts=?,available_at=now()+(? * interval '1 second') where id=?",attempt,retrySeconds(attempt),id);
                        } else db.update("delete from push_outbox where id=?",id);
                        log.warn("Push attempt failed job={} code={} attempt={}",id,e.getMessagingErrorCode(),attempt);
                    }
                    return true;
                });
                if(!Boolean.TRUE.equals(processed)) break;
            }
        } catch(Exception e) { log.warn("Push worker unavailable type={}",e.getClass().getSimpleName()); }
    }
    @PreDestroy void close() { if(app!=null) app.delete(); }
}
