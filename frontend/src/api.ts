import { QueryClient } from "@tanstack/react-query";
export const qc = new QueryClient();
export let csrf = { token: "", header: "" };
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function request(path: string, options: RequestInit = {}) {
  try {
    return await fetch(path, { ...options, credentials: 'same-origin', signal: AbortSignal.timeout(90000) });
  } catch {
    throw new ApiError(navigator.onLine ? '서버 응답이 늦습니다. 무료 서버가 기동 중일 수 있습니다. 잠시 후 다시 시도하세요.' : '인터넷 연결을 확인하세요.', 0);
  }
}
let tokenRequest: Promise<void> | undefined;
export function token(): Promise<void> {
  if (!tokenRequest) tokenRequest = (async () => {
    const response = await request('/api/csrf');
    if (!response.ok) throw new ApiError('인증 서버에 연결할 수 없습니다', response.status);
    csrf = await response.json();
  })().finally(() => { tokenRequest = undefined; });
  return tokenRequest;
}
export async function api(path: string, body?: unknown) {
  if (body !== undefined) await token();
  const r = await request('/api' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json', [csrf.header]: csrf.token },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) {
    if(r.status === 401 && path !== '/me') {
      qc.removeQueries({ predicate: q => q.queryKey[0] !== 'me' });
      qc.setQueryData(['me'], null);
    }
    throw new ApiError(r.status === 401 ? '로그인이 필요합니다' : await r.json().then(e => e.message || '요청을 처리하지 못했습니다').catch(() => '요청을 처리하지 못했습니다'), r.status);
  }
  return r.status === 204 ? null : r.text().then(t => t ? JSON.parse(t) : null);
}
