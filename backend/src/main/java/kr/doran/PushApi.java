package kr.doran;
import java.security.Principal;
import java.util.Map;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.annotation.Transactional;
@RestController @RequestMapping("/api/push")
public class PushApi {
    private final PushService push;
    private final Api api;
    PushApi(PushService push,Api api) { this.push=push; this.api=api; }
    @GetMapping("/status") Object status(HttpServletRequest request) { return Map.of("enabled",push.enabled(),"registered",push.registered(request.getSession().getId()),"platform","android"); }
    record Device(String token) {}
    @PostMapping("/register") @Transactional
    void register(Principal principal,HttpServletRequest request,@RequestBody Device device) {
        if(!push.enabled()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"푸시 설정이 필요합니다");
        if(device.token()==null || device.token().length()<20 || device.token().length()>4096)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        push.register(api.uid(principal),request.getSession().getId(),device.token());
    }
    @PostMapping("/unregister")
    void unregister(HttpServletRequest request) { push.unregisterSession(request.getSession().getId()); }
}
