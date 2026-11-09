package kr.doran;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.*;
import java.util.concurrent.ConcurrentHashMap;
public class RequestLimits extends OncePerRequestFilter {
    private record Window(long start, int count) {}
    private final ConcurrentHashMap<String,Window> windows = new ConcurrentHashMap<>();
    protected void doFilterInternal(HttpServletRequest q, HttpServletResponse s, FilterChain chain) throws IOException, ServletException {
        if (!q.getRequestURI().startsWith("/api/") || !"POST".equals(q.getMethod())) { chain.doFilter(q,s); return; }
        long now=System.currentTimeMillis();
        windows.entrySet().removeIf(e -> now-e.getValue().start() >= 60000);
        if (windows.size()>10000) { s.sendError(429); return; }
        var w=windows.compute(q.getRemoteAddr(),(k,v)->v==null?new Window(now,1):new Window(v.start(),v.count()+1));
        if(w.count()>240) { s.setHeader("Retry-After","60"); s.sendError(429); return; }
        if(q.getContentType()==null || !q.getContentType().startsWith("application/json")) { chain.doFilter(q,s); return; }
        byte[] bytes=q.getInputStream().readNBytes(16385);
        if(bytes.length>16384) { s.sendError(413); return; }
        chain.doFilter(new HttpServletRequestWrapper(q) {
            public ServletInputStream getInputStream() {
                var input=new ByteArrayInputStream(bytes);
                return new ServletInputStream() {
                    public int read() { return input.read(); }
                    public boolean isFinished() { return input.available()==0; }
                    public boolean isReady() { return true; }
                    public void setReadListener(ReadListener listener) { throw new UnsupportedOperationException(); }
                };
            }
            public BufferedReader getReader() { return new BufferedReader(new InputStreamReader(getInputStream(), java.nio.charset.StandardCharsets.UTF_8)); }
        },s);
    }
}
