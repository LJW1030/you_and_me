package kr.doran;

import java.util.*;
import java.security.Principal;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.socket.config.annotation.*;
import org.springframework.messaging.simp.config.*;
import org.springframework.messaging.support.*;
import org.springframework.messaging.*;
import org.springframework.messaging.simp.stomp.*;

@Configuration
@EnableWebSocketMessageBroker
public class Security implements WebSocketMessageBrokerConfigurer {
    private final LiveSessions liveSessions;
    public Security(LiveSessions liveSessions) { this.liveSessions = liveSessions; }
    public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
        registration.addDecoratorFactory(liveSessions::decorate);
    }
    @Bean BCryptPasswordEncoder encoder() { return new BCryptPasswordEncoder(); }
    @Bean SecurityFilterChain filter(HttpSecurity http, PushService push) throws Exception {
        return http.addFilterBefore(new AccountRateLimit(), org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter.class).csrf(c -> c.csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler())).addFilterBefore(new RequestLimits(), org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter.class).authorizeHttpRequests(a -> a.requestMatchers("/", "/index.html", "/assets/**", "/rooms/*", "/healthz", "/api/accounts/availability", "/api/csrf", "/api/register", "/api/login", "/error").permitAll().anyRequest().authenticated())
            .formLogin(f -> f.loginProcessingUrl("/api/login").successHandler((q,s,a)->s.setStatus(204)).failureHandler((q,s,e)->s.sendError(401)))
            .logout(l -> l.logoutUrl("/api/logout").addLogoutHandler((q,s,a) -> { var session=q.getSession(false); if(session!=null) push.unregisterSession(session.getId()); if(a!=null) liveSessions.revoke(a.getName()); }).logoutSuccessHandler((q,s,a)->s.setStatus(204)))
            .exceptionHandling(e -> e.authenticationEntryPoint((q,s,x)->s.sendError(401))).build();
    }
    @Bean org.springframework.security.core.userdetails.UserDetailsService users(org.springframework.jdbc.core.JdbcTemplate db) {
        return login -> {
            var rows=db.queryForList("select * from users where login=?",login);
            if(rows.isEmpty()) throw new org.springframework.security.core.userdetails.UsernameNotFoundException(login);
            var u=rows.get(0);
            return org.springframework.security.core.userdetails.User.withUsername(login).password((String)u.get("password")).roles("USER").build();
        };
    }
    public void registerStompEndpoints(StompEndpointRegistry r) { r.addEndpoint("/ws").addInterceptors(new org.springframework.security.messaging.web.socket.server.CsrfTokenHandshakeInterceptor()); }
    @Bean
    public org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler stompHeartbeatScheduler() {
        var scheduler = new org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler();
        scheduler.setPoolSize(1);
        scheduler.setThreadNamePrefix("stomp-heartbeat-");
        return scheduler;
    }
    public void configureMessageBroker(MessageBrokerRegistry r) {
        r.enableSimpleBroker("/queue").setTaskScheduler(stompHeartbeatScheduler())
            .setHeartbeatValue(new long[]{10000, 10000});
    }
    public void configureClientInboundChannel(ChannelRegistration r) {
        r.interceptors(new ChannelInterceptor() {
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                var h=MessageHeaderAccessor.getAccessor(message,StompHeaderAccessor.class);
                if(h==null) return message;
                if(h.getUser()==null) throw new IllegalArgumentException("로그인 필요");
                if(h.getCommand()==StompCommand.CONNECT) {
                    var t=(CsrfToken)h.getSessionAttributes().get(CsrfToken.class.getName());
                    if(t==null || !t.getToken().equals(h.getFirstNativeHeader(t.getHeaderName()))) throw new IllegalArgumentException("CSRF");
                }
                if(h.getCommand()==StompCommand.SEND || (h.getCommand()==StompCommand.SUBSCRIBE && !"/user/queue/events".equals(h.getDestination()))) throw new IllegalArgumentException("금지된 목적지");
                return message;
            }
        });
    }
}
