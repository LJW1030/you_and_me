package kr.doran;

import java.util.*;
import java.security.Principal;
import org.springframework.web.bind.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class Api {
    private final JdbcTemplate db;
    private final BCryptPasswordEncoder encoder;
    private final TransactionTemplate tx;
    private final SimpMessagingTemplate events;
    private final Mapper mapper;
    Api(JdbcTemplate db, BCryptPasswordEncoder encoder, TransactionTemplate tx, SimpMessagingTemplate events, Mapper mapper) {
        this.db=db; this.encoder=encoder; this.tx=tx; this.events=events; this.mapper=mapper;
    }
    long uid(Principal p) { return db.queryForObject("select id from users where login=?",Long.class,p.getName()); }
    void member(long room,long user) {
        if(db.queryForObject("select count(*) from members where room=? and usr=?",Integer.class,room,user)==0) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
    }
    void emit(long room) {
        for(var u:db.queryForList("select u.login from users u join members m on m.usr=u.id where m.room=?",room)) events.convertAndSendToUser((String)u.get("login"),"/queue/events",Map.of("room",room));
    }
    @GetMapping("/csrf") Object csrf(CsrfToken token) { return Map.of("token",token.getToken(),"header",token.getHeaderName()); }
    @PostMapping("/register") void register(@RequestBody Map<String,String> b) {
        String login=b.getOrDefault("login",""), pass=b.getOrDefault("password",""), nick=b.getOrDefault("nickname","").trim();
        Accounts.password(pass);
        if(!login.matches("[a-zA-Z0-9_]{3,40}") || pass.length()<8 || pass.length()>72 || nick.isEmpty() || nick.length()>40) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"아이디 3~40자, 비밀번호 8~72자, 닉네임 1~40자를 확인하세요");
        if(db.queryForObject("select count(*) from users where login=?",Integer.class,login)>0) throw new ResponseStatusException(HttpStatus.CONFLICT,"이미 사용 중인 아이디");
        db.update("insert into users(login,password,nickname) values(?,?,?)",login,encoder.encode(pass),nick);
    }
    @GetMapping("/me") Object me(Principal p) { return db.queryForMap("select id,login,nickname from users where id=?",uid(p)); }
    @GetMapping("/users") Object search(@RequestParam String login) { return db.queryForList("select id,login,nickname from users where login=?",login); }
    @GetMapping("/friends") Object friends(Principal p) { return db.queryForList("select u.id,u.login,u.nickname from friends f join users u on u.id=f.friend where owner=? order by nickname",uid(p)); }
    @PostMapping("/friends") void add(Principal p,@RequestBody Map<String,Long> b) {
        long id=uid(p), friend=b.get("id");
        if(id==friend) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"자신은 추가할 수 없습니다");
        db.update("insert into friends values(?,?) on conflict do nothing",id,friend);
    }
    @GetMapping("/rooms") Object rooms(Principal p) {
        return db.queryForList("select r.*, (select body from messages where room=r.id order by seq desc limit 1) as last_message, (select sent_at from messages where room=r.id order by seq desc limit 1) as activity, (select count(*) from messages where room=r.id and seq>m.last_read and sender<>m.usr) as unread from rooms r join members m on m.room=r.id where m.usr=? order by activity desc nulls last,r.id desc",uid(p));
    }
    record Create(List<Long> members,String title) {}
    @PostMapping("/rooms") Object create(Principal p,@RequestBody Create b) {
        long id=uid(p);
        var ids=new TreeSet<Long>(b.members()); ids.remove(id);
        if(ids.isEmpty() || ids.size()>50) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        for(long friend:ids) if(db.queryForObject("select count(*) from friends where owner=? and friend=?",Integer.class,id,friend)==0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"친구를 선택하세요");
        ids.add(id);
        Long room=tx.execute(s -> {
            String key=ids.size()==2 ? ids.first()+":"+ids.last():null;
            String title=b.title()==null || b.title().isBlank()?"도란 대화":b.title().strip();
            if(title.length()>100) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
            Long r=db.queryForObject("insert into rooms(direct_key,title) values(?,?) on conflict(direct_key) do update set direct_key=excluded.direct_key returning id",Long.class,key,title);
            for(long u:ids) db.update("insert into members(room,usr) values(?,?) on conflict do nothing",r,u);
            return r;
        });
        emit(room); return Map.of("id",room);
    }
    @GetMapping("/rooms/{room}/members") Object members(Principal p,@PathVariable long room) { member(room,uid(p)); return db.queryForList("select m.*,u.nickname from members m join users u on u.id=m.usr where room=?",room); }
    @GetMapping("/rooms/{room}/messages") Object history(Principal p,@PathVariable long room,@RequestParam(required=false) Long beforeSeq,@RequestParam(required=false) Long afterSeq) { member(room,uid(p)); return mapper.history(room,beforeSeq,afterSeq); }
    record Send(UUID clientMessageId,String body) {}
    @PostMapping("/rooms/{room}/messages") Object send(Principal p,@PathVariable long room,@RequestBody Send b) {
        long id=uid(p); member(room,id);
        if(b.clientMessageId()==null || b.body()==null || b.body().isBlank() || b.body().length()>2000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        var result=tx.execute(s -> {
            db.queryForObject("select seq from rooms where id=? for update",Long.class,room);
            var old=db.queryForList("select * from messages where room=? and sender=? and client_id=?",room,id,b.clientMessageId());
            if(!old.isEmpty()) return old.get(0);
            long seq=db.queryForObject("update rooms set seq=seq+1 where id=? returning seq",Long.class,room);
            return db.queryForMap("insert into messages(room,seq,sender,client_id,body) values(?,?,?,?,?) returning *",room,seq,id,b.clientMessageId(),b.body());
        }); emit(room); return result;
    }
    @PostMapping("/rooms/{room}/read") void read(Principal p,@PathVariable long room,@RequestBody Map<String,Long> b) {
        long id=uid(p); member(room,id);
        db.update("update members set last_read=greatest(last_read,least(?,(select seq from rooms where id=?))) where room=? and usr=?",b.get("seq"),room,room,id); emit(room);
    }
}
