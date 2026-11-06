import { useState } from "react";
import { api, qc, token, csrf } from "./api";
export default function ProfilePage({
  me,
}: {
  me: { nickname: string; login: string };
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent<HTMLFormElement>, path: string) {
    e.preventDefault();
    const form = e.currentTarget;
    const b = Object.fromEntries(new FormData(form));
    if (path === "/me/password" && b.password !== b.confirm) {
      setMessage("새 비밀번호 확인이 일치하지 않습니다");
      return;
    }
    setBusy(true);
    try {
      await api(path, b);
      await qc.invalidateQueries();
      setMessage("변경했습니다.");
      if (path === "/me/password") {
        location.reload();
      } else form.reset();
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="profile">
      <h2>내 정보</h2>
      <p>@{me.login}</p>
      <form onSubmit={(e) => save(e, "/me/profile")}>
        <label>
          닉네임
          <input
            name="nickname"
            defaultValue={me.nickname}
            required
            maxLength={40}
          />
        </label>
        <button disabled={busy}>닉네임 저장</button>
      </form>
      <h3>비밀번호 변경</h3>
      <form onSubmit={(e) => save(e, "/me/password")}>
        <input
          aria-label="현재 비밀번호"
          name="currentPassword"
          type="password"
          placeholder="현재 비밀번호"
          required
          autoComplete="current-password"
        />
        <input
          aria-label="새 비밀번호"
          name="password"
          type="password"
          placeholder="새 비밀번호 (8자 이상, UTF-8 72바이트 이하)"
          required
          minLength={8}
          autoComplete="new-password"
        />
        <input
          aria-label="새 비밀번호 확인"
          name="confirm"
          type="password"
          placeholder="새 비밀번호 확인"
          required
          autoComplete="new-password"
        />
        <p>변경 후 모든 기기에서 다시 로그인합니다.</p>
        <button disabled={busy}>비밀번호 변경</button>
      </form>
      <p role="status">{message}</p>
      <button
        onClick={async () => {
          await token();
          await fetch("/api/logout", {
            method: "POST",
            headers: { [csrf.header]: csrf.token },
          });
          qc.clear();
          location.assign("/");
        }}
      >
        로그아웃
      </button>
    </section>
  );
}
