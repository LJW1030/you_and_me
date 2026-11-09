package kr.doran;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;
@Controller
public class WebPages {
    @GetMapping({"/", "/rooms/{room:[0-9]+}"})
    String index() { return "forward:/index.html"; }
    // Liveness only: do not wake a sleeping Neon database from platform health probes.
    @GetMapping("/healthz") @ResponseBody
    String health() { return "ok"; }
}
