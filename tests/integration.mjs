import assert from "node:assert/strict";
const base = "http://localhost:3000/api";
async function user(name) {
  let cookie = "",
    csrf;
  async function call(path, body, form = false) {
    const r = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Cookie: cookie,
        ...(body === undefined
          ? {}
          : {
              [csrf.header]: csrf.token,
              "Content-Type": form
                ? "application/x-www-form-urlencoded"
                : "application/json",
            }),
      },
      body:
        body === undefined
          ? undefined
          : form
            ? new URLSearchParams(body)
            : JSON.stringify(body),
    });
    const set = r.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    return r;
  }
  csrf = await (await call("/csrf")).json();
  assert.equal(
    (
      await call("/register", {
        login: name,
        password: "password123",
        nickname: name,
      })
    ).status,
    200,
  );
  assert.equal(
    (await call("/login", { username: name, password: "password123" }, true))
      .status,
    204,
  );
  csrf = await (await call("/csrf")).json();
  return { call, id: (await (await call("/me")).json()).id };
}
const stamp = Date.now();
const a = await user("a" + stamp),
  b = await user("b" + stamp),
  c = await user("c" + stamp);
await a.call("/friends", { id: b.id });
await b.call("/friends", { id: a.id });
const [ra, rb] = await Promise.all([
  a.call("/rooms", { members: [b.id] }).then((r) => r.json()),
  b.call("/rooms", { members: [a.id] }).then((r) => r.json()),
]);
assert.equal(ra.id, rb.id);
const path = "/rooms/" + ra.id;
const msg = {
  clientMessageId: crypto.randomUUID(),
  body: "안녕하세요 한글 테스트",
};
const first = await (await a.call(path + "/messages", msg)).json();
const second = await (await a.call(path + "/messages", msg)).json();
assert.equal(first.seq, second.seq);
for (let i = 0; i < 35; i++)
  assert.equal(
    (
      await a.call(path + "/messages", {
        clientMessageId: crypto.randomUUID(),
        body: "메시지 " + i,
      })
    ).status,
    200,
  );
let seq = 0,
  total = 0;
while (true) {
  const rows = await (await b.call(path + "/messages?afterSeq=" + seq)).json();
  total += rows.length;
  if (!rows.length) break;
  seq = rows.at(-1).seq;
}
assert.equal(total, 36);
assert.equal((await c.call(path + "/messages")).status, 403);
assert.equal((await c.call(path + "/messages", msg)).status, 403);
assert.equal((await c.call(path + "/read", { seq: 36 })).status, 403);
assert.equal((await fetch(base + path + "/messages")).status, 401);
await b.call(path + "/read", { seq: 36 });
await b.call(path + "/read", { seq: 1 });
const members = await (await a.call(path + "/members")).json();
assert.equal(members.find((x) => x.usr === b.id).last_read, 36);
console.log(
  "PASS PostgreSQL: signup/login, concurrent direct room, idempotency, 36-message pagination, membership, monotonic read",
);
