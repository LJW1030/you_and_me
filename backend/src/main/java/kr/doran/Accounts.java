package kr.doran;

import java.security.Principal;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.support.TransactionTemplate;

@RestController
@RequestMapping("/api")
public class Accounts {
    private final JdbcTemplate db;
    private final BCryptPasswordEncoder encoder;
    private final TransactionTemplate tx;
    private final LiveSessions liveSessions;
    public Accounts(JdbcTemplate db, BCryptPasswordEncoder encoder, TransactionTemplate tx, LiveSessions liveSessions) {
        this.db = db; this.encoder = encoder; this.tx = tx; this.liveSessions = liveSessions;
    }
    static void password(String password) {
        if (password == null || password.length() < 8 || password.getBytes(StandardCharsets.UTF_8).length > 72)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "비밀번호는 8자 이상, UTF-8 72바이트 이하여야 합니다");
    }
    @GetMapping("/accounts/availability") Object available(@RequestParam String login) {
        if (!login.matches("[a-zA-Z0-9_]{3,40}")) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "아이디 형식을 확인하세요");
        return Map.of("available", db.queryForObject("select count(*) from users where login=?", Integer.class, login) == 0);
    }
    @PostMapping("/me/profile") void profile(Principal principal, @RequestBody Map<String,String> body) {
        String nickname = body.getOrDefault("nickname", "").strip();
        if (nickname.isEmpty() || nickname.length() > 40) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "닉네임은 1~40자여야 합니다");
        db.update("update users set nickname=? where login=?", nickname, principal.getName());
    }
    @PostMapping("/me/password") void changePassword(Principal principal, @RequestBody Map<String,String> body, HttpServletRequest request) {
        password(body.get("password"));
        tx.executeWithoutResult(status -> {
            String hash = db.queryForObject("select password from users where login=? for update", String.class, principal.getName());
            if (!encoder.matches(body.getOrDefault("currentPassword", ""), hash))
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "현재 비밀번호가 일치하지 않습니다");
            db.update("update users set password=? where login=?", encoder.encode(body.get("password")), principal.getName());
            db.update("delete from spring_session where principal_name=?", principal.getName());
        });
        request.getSession().invalidate();
        liveSessions.revoke(principal.getName());
    }
}
