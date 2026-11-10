import { enablePush, disablePush } from "./useMobile";
import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";
import { useState, useEffect } from "react";
import { api, qc, token, csrf, request } from "./api";
export default function ProfilePage({
  me,
}: {
  me: { nickname: string; login: string };
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const status=(e:Event)=>setMessage((e as CustomEvent<string>).detail);
    window.addEventListener('push-status',status);
    return ()=>window.removeEventListener('push-status',status);
  },[]);
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
      {Capacitor.getPlatform() === 'android' && <button onClick={async()=>{try{await enablePush();setMessage('알림 등록을 요청했습니다. 실제 수신 여부를 확인해주세요.');}catch(e){setMessage(String(e));}}}>메시지 알림 켜기</button>}
      {Capacitor.getPlatform() === 'android' && <button onClick={async()=>{try{await disablePush();setMessage('이 기기의 메시지 알림을 껐습니다.');}catch(e){setMessage(String(e));}}}>메시지 알림 끄기</button>}
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
          try {
          await token();
          const response = await request("/api/logout", {
            method: "POST",
            headers: { [csrf.header]: csrf.token },
          });
          if(!response.ok) throw new Error("로그아웃 실패. 연결을 확인하고 다시 시도하세요.");
          if(Capacitor.isNativePlatform()) await PushNotifications.removeAllDeliveredNotifications().catch(()=>{});
          qc.clear();
          location.assign("/");
          } catch(e) { setMessage(String(e)); }
        }}
      >
        로그아웃
      </button>
    </section>
  );
}
