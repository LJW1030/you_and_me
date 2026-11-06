import { QueryClient } from "@tanstack/react-query";
export const qc = new QueryClient();
export let csrf = { token: "", header: "" };
export async function token() {
  const response = await fetch("/api/csrf", {signal: AbortSignal.timeout(10000)});
  if (!response.ok) throw new Error("인증 서버에 연결할 수 없습니다");
  csrf = await response.json();
}
export async function api(path: string, body?: unknown) {
  if (body !== undefined) await token();
  const r = await fetch("/api" + path, {
    method: body === undefined ? "GET" : "POST",
    headers:
      body === undefined
        ? {}
        : { "Content-Type": "application/json", [csrf.header]: csrf.token },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok)
    throw new Error(
      r.status === 401
        ? "로그인이 필요합니다"
        : await r
            .json()
            .then((e) => e.message || "요청을 처리하지 못했습니다")
            .catch(() => "요청을 처리하지 못했습니다"),
    );
  return r.status === 204 || r.headers.get("content-length") === "0"
    ? null
    : await r.text().then((t) => (t ? JSON.parse(t) : null));
}
