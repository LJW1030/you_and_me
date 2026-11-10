package kr.doran;

import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.support.TransactionCallback;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class PushServiceTest {
    @Test void retryPolicyIsBoundedAndDoesNotRetryBadTokens() {
        assertEquals(60,PushService.retrySeconds(1));
        assertEquals(3600,PushService.retrySeconds(8));
        assertTrue(PushService.retryable(MessagingErrorCode.UNAVAILABLE));
        assertTrue(PushService.retryable(MessagingErrorCode.QUOTA_EXCEEDED));
        assertFalse(PushService.retryable(MessagingErrorCode.INVALID_ARGUMENT));
        assertFalse(PushService.retryable(MessagingErrorCode.UNREGISTERED));
        assertFalse(PushService.retryable(null));
    }
    @Test void disabledPushDoesNotTouchDatabase() {
        var db=mock(JdbcTemplate.class);
        var service=new PushService(db,mock(TransactionTemplate.class),null);
        service.enqueue(1,2,3); service.drain();
        verifyNoInteractions(db);
    }
    @Test void sameTokenRegistrationPreservesPendingJobs() {
        var db=mock(JdbcTemplate.class);
        new PushService(db,mock(TransactionTemplate.class),null).register(5,"session","device-token");
        verify(db).update(eq("delete from push_devices where session_id=? and token_hash<>?"),eq("session"),eq(PushService.hash("device-token")));
        verify(db,never()).update(eq("delete from push_devices where session_id=?"),anyString());
    }
    @Test void loggedOutOrReadRecipientDoesNotReachFcm() {
        var db=mock(JdbcTemplate.class);var tx=mock(TransactionTemplate.class);var app=mock(FirebaseApp.class);
        when(tx.execute(any())).thenAnswer(i->((TransactionCallback<?>)i.getArgument(0)).doInTransaction(null));
        var job=Map.<String,Object>of("id",9L,"room",1L,"seq",2L,"token_hash","hash","recipient",3L,"session_id","session","created_at",new java.sql.Timestamp(System.currentTimeMillis()),"attempts",0);
        when(db.queryForList(startsWith("select * from push_outbox"))).thenReturn(List.of(job),List.of());
        when(db.queryForList(contains("select d.token"),any(Object[].class))).thenReturn(List.of());
        try(var fcm=mockStatic(FirebaseMessaging.class)) {
            new PushService(db,tx,app).drain();
            fcm.verifyNoInteractions();
        }
        verify(db).update("delete from push_outbox where id=?",9L);
    }
    @Test void temporaryFailureKeepsJobForRetry() throws Exception {
        var db=mock(JdbcTemplate.class);var tx=mock(TransactionTemplate.class);var app=mock(FirebaseApp.class);var messaging=mock(FirebaseMessaging.class);
        when(tx.execute(any())).thenAnswer(i->((TransactionCallback<?>)i.getArgument(0)).doInTransaction(null));
        var job=Map.<String,Object>of("id",9L,"room",1L,"seq",2L,"token_hash","hash","recipient",3L,"session_id","session","created_at",new java.sql.Timestamp(System.currentTimeMillis()),"attempts",0);
        when(db.queryForList(startsWith("select * from push_outbox"))).thenReturn(List.of(job),List.of());
        when(db.queryForList(contains("select d.token"),any(Object[].class))).thenReturn(List.of(Map.of("token","test-token")));
        var failure=mock(FirebaseMessagingException.class);
        when(failure.getMessagingErrorCode()).thenReturn(MessagingErrorCode.UNAVAILABLE);
        when(messaging.send(any(Message.class))).thenThrow(failure);
        try(var fcm=mockStatic(FirebaseMessaging.class)) {
            fcm.when(()->FirebaseMessaging.getInstance(app)).thenReturn(messaging);
            new PushService(db,tx,app).drain();
        }
        verify(db).update("update push_outbox set attempts=?,available_at=now()+(? * interval '1 second') where id=?",1,60L,9L);
        verify(db,never()).update("delete from push_outbox where id=?",9L);
    }
}
