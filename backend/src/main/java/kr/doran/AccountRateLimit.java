package kr.doran;
import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.web.filter.OncePerRequestFilter;
public class AccountRateLimit extends OncePerRequestFilter {
    private record Window(long start, int count) {}
    private final ConcurrentHashMap<String,Window> attempts = new ConcurrentHashMap<>();
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        String path=request.getRequestURI();
        if (!path.equals("/api/login") && !path.equals("/api/register") && !path.equals("/api/me/password")) { chain.doFilter(request,response); return; }
        long now=System.currentTimeMillis();
        attempts.entrySet().removeIf(e -> now-e.getValue().start()>60000);
        String key=request.getRemoteAddr()+":"+path;
        Window window=attempts.compute(key,(k,v)->v==null?new Window(now,1):new Window(v.start(),v.count()+1));
        if(window.count()>20) { response.setStatus(429); response.setHeader("Retry-After","60"); response.setContentType("application/json;charset=UTF-8"); response.getWriter().write("{\"message\":\"시도가 너무 많습니다. 잠시 후 다시 시도하세요\"}"); return; }
        chain.doFilter(request,response);
    }
}
