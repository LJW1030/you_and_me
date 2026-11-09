package kr.doran;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.*;
import static org.junit.jupiter.api.Assertions.*;
class RequestLimitsTest {
    @Test void rejectsChunkedOversizedJson() throws Exception {
        var q=new MockHttpServletRequest("POST","/api/rooms/1/messages");
        q.setContentType("application/json"); q.setContent(new byte[16385]);
        var s=new MockHttpServletResponse(); var chain=new MockFilterChain();
        new RequestLimits().doFilter(q,s,chain);
        assertEquals(413,s.getStatus()); assertNull(chain.getRequest());
    }
    @Test void preservesJsonForController() throws Exception {
        var q=new MockHttpServletRequest("POST","/api/rooms/1/messages");
        q.setContentType("application/json"); q.setContent("{\"body\":\"안녕\"}".getBytes(java.nio.charset.StandardCharsets.UTF_8));
        var s=new MockHttpServletResponse(); var chain=new MockFilterChain();
        new RequestLimits().doFilter(q,s,chain);
        assertEquals(200,s.getStatus());
        assertEquals("{\"body\":\"안녕\"}",new String(chain.getRequest().getInputStream().readAllBytes(),java.nio.charset.StandardCharsets.UTF_8));
    }
    @Test void throttlesBurstWithoutBlockingHealth() throws Exception {
        var filter=new RequestLimits();
        for(int i=0;i<240;i++) filter.doFilter(new MockHttpServletRequest("POST","/api/push/register"),new MockHttpServletResponse(),new MockFilterChain());
        var s=new MockHttpServletResponse();
        filter.doFilter(new MockHttpServletRequest("POST","/api/push/register"),s,new MockFilterChain());
        assertEquals(429,s.getStatus());
        var health=new MockHttpServletResponse();
        filter.doFilter(new MockHttpServletRequest("GET","/healthz"),health,new MockFilterChain());
        assertEquals(200,health.getStatus());
    }
}
