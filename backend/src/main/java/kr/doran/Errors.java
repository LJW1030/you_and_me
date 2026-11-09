package kr.doran;
import java.util.Map;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.dao.DuplicateKeyException;
@RestControllerAdvice
public class Errors {
    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<?> status(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode()).body(Map.of("message", e.getReason()==null ? "요청을 처리할 수 없습니다" : e.getReason()));
    }
    @ExceptionHandler(DuplicateKeyException.class)
    ResponseEntity<?> duplicate() {
        return ResponseEntity.status(409).body(Map.of("message", "이미 등록된 값입니다. 아이디를 확인하세요"));
    }
}
