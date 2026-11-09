package kr.doran;

import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.WebSocketHandlerDecorator;

/** Tracks transports so credential revocation also closes existing subscriptions. */
@Component
public class LiveSessions {
    private final ConcurrentHashMap<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    public WebSocketHandler decorate(WebSocketHandler handler) {
        return new WebSocketHandlerDecorator(handler) {
            @Override
            public void afterConnectionEstablished(WebSocketSession session) throws Exception {
                sessions.put(session.getId(), session);
                try {
                    super.afterConnectionEstablished(session);
                } catch (Exception error) {
                    sessions.remove(session.getId());
                    throw error;
                }
            }
            @Override
            public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
                sessions.remove(session.getId());
                super.afterConnectionClosed(session, status);
            }
        };
    }

    public void revoke(String login) {
        sessions.forEach((id, session) -> {
            if (session.getPrincipal() != null && login.equals(session.getPrincipal().getName())) {
                try {
                    session.close(CloseStatus.POLICY_VIOLATION);
                } catch (IOException error) {
                    // A concurrently disconnected transport has no live subscription.
                } finally {
                    sessions.remove(id);
                }
            }
        });
    }
}
