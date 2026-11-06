import { useState } from "react";
import { api, token, csrf } from "./api";
export default function Auth({ done }: { done: () => void }) {
  const [register, setRegister] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [login, setLogin] = useState(""),
    [availability, setAvailability] = useState("");
  return (
    <div className="auth">
      <div className="logo">◒</div>
      <h1>니랑내</h1>
      <p>오늘의 이야기를 나눠요</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          const b = Object.fromEntries(new FormData(e.currentTarget));
          if (register && b.password !== b.confirm) {
            setError("비밀번호 확인이 일치하지 않습니다");
            return;
          }
          if (
            register &&
            (String(b.password).length < 8 ||
              new TextEncoder().encode(String(b.password)).length > 72)
          ) {
            setError(
              "비밀번호는 8자 이상, UTF-8 기준 72바이트 이하여야 합니다",
            );
            return;
          }
          setBusy(true);
          try {
            await token();
            if (register) await api("/register", b);
            const r = await fetch("/api/login", {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                [csrf.header]: csrf.token,
              },
              body: new URLSearchParams({
                username: String(b.login),
                password: String(b.password),
              }),
            });
            if (!r.ok)
              throw Error(
                r.status === 429
                  ? "시도가 너무 많습니다. 잠시 후 다시 시도하세요"
                  : "아이디와 비밀번호를 확인하세요",
              );
            await token();
            done();
          } catch (e) {
            setError(String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          아이디
          <input
            name="login"
            value={login}
            onChange={(e) => {
              setLogin(e.target.value);
              setAvailability("");
            }}
            pattern="[a-zA-Z0-9_]{3,40}"
            title="영문, 숫자, 밑줄 3~40자"
            required
            autoComplete="username"
          />
        </label>
        {register && (
          <>
            <button
              type="button"
              disabled={busy || !/^[a-zA-Z0-9_]{3,40}$/.test(login)}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await api(
                    "/accounts/availability?login=" + encodeURIComponent(login),
                  );
                  setAvailability(
                    r.available
                      ? "사용 가능한 아이디입니다"
                      : "이미 사용 중인 아이디입니다",
                  );
                } catch (e) {
                  setError(String(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              아이디 중복 확인
            </button>
            <small role="status">{availability}</small>
          </>
        )}
        <label>
          비밀번호
          <input
            name="password"
            type="password"
            required
            autoComplete={register ? "new-password" : "current-password"}
          />
        </label>
        {register && (
          <>
            <small>8자 이상, UTF-8 기준 72바이트 이하</small>
            <label>
              비밀번호 확인
              <input
                name="confirm"
                type="password"
                required
                autoComplete="new-password"
              />
            </label>
            <label>
              닉네임
              <input name="nickname" maxLength={40} required />
            </label>
          </>
        )}
        <p role="alert">{error}</p>
        <button disabled={busy}>
          {busy ? "처리 중…" : register ? "가입하고 시작" : "로그인"}
        </button>
      </form>
      <button
        className="link"
        disabled={busy}
        onClick={() => {
          setRegister(!register);
          setError("");
          setAvailability("");
        }}
      >
        {register ? "로그인으로 돌아가기" : "처음이신가요? 회원가입"}
      </button>
    </div>
  );
}
