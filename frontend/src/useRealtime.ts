import { useEffect, type MutableRefObject } from 'react';
import { Client, ReconnectionTimeMode, TickerStrategy } from '@stomp/stompjs';
import { qc, token, csrf } from './api';

export function useRealtime(userId: number | undefined, ready: MutableRefObject<boolean>, sync: MutableRefObject<() => Promise<void>>, setStatus: (s: string) => void) {
  useEffect(() => {
    if (!userId) return;
    let disposed = false, expired = false, connectedOnce = false, paused = document.hidden;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let delay = 2000;
    const refresh = () => { void qc.invalidateQueries({ queryKey: ['rooms'] }); void sync.current(); };
    const expire = () => {
      expired = true; ready.current = false; void client.deactivate();
      qc.removeQueries({ predicate: q => q.queryKey[0] !== 'me' });
      qc.setQueryData(['me'], null); setStatus('로그인이 만료되었습니다');
    };
    const client = new Client({
      brokerURL: `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`,
      reconnectDelay: 2000, maxReconnectDelay: 30000, reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
      connectionTimeout: 15000, heartbeatIncoming: 10000, heartbeatOutgoing: 10000,
      heartbeatToleranceMultiplier: 3, heartbeatStrategy: TickerStrategy.Worker,
      beforeConnect: async () => {
        if (disposed || expired || paused) { void client.deactivate(); return; }
        try {
          const response = await fetch('/api/me', { signal: AbortSignal.timeout(10000) });
          if (response.status === 401) { expire(); return; }
          if (!response.ok) throw Error('서버 응답 실패');
          await token();
          if (disposed || expired || paused) { void client.deactivate(); return; }
          client.connectHeaders = { [csrf.header]: csrf.token };
          setStatus(connectedOnce ? '재연결 중' : '연결 중');
        } catch {
          void client.deactivate().then(() => {
            if (disposed || expired || paused) return;
            setStatus(navigator.onLine ? '서버 연결 대기 중' : '인터넷 연결 없음');
            retry = setTimeout(() => { if (!disposed && !expired && !paused) client.activate(); }, delay);
            delay = Math.min(delay * 2, 30000);
          });
        }
      },
      onConnect: () => {
        if (paused || disposed) { void client.deactivate(); return; }
        connectedOnce = true; delay = 2000; ready.current = true;
        // Spring simple broker has no STOMP receipts; history is authoritative.
        client.subscribe('/user/queue/events', refresh);
        setStatus('연결됨'); refresh();
      },
      onWebSocketClose: () => {
        ready.current = false;
        if (!disposed && !expired && !paused) setStatus(navigator.onLine ? '연결 복구 중' : '인터넷 연결 없음');
      },
      onStompError: () => { ready.current = false; setStatus('연결을 확인하고 있습니다'); },
    });
    const resume = () => {
      if (disposed || expired || paused || document.hidden || !navigator.onLine) return;
      clearTimeout(retry); retry = undefined;
      if (!client.active) client.activate();
      if (ready.current) refresh();
    };
    const suspend = () => { paused = true; ready.current = false; clearTimeout(retry); void client.deactivate(); };
    const foreground = () => { paused = false; resume(); };
    const visibility = () => { if (document.hidden) suspend(); else foreground(); };
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('app-suspend', suspend);
    window.addEventListener('app-resume', foreground);
    if (!paused) client.activate();
    // Actual foreground state reconciliation, never a background keep-alive.
    const recovery = setInterval(() => { if (ready.current && !document.hidden && !paused) refresh(); }, 30000);
    return () => {
      disposed = true; ready.current = false; clearTimeout(retry); clearInterval(recovery);
      window.removeEventListener('online', resume); document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('app-suspend', suspend); window.removeEventListener('app-resume', foreground);
      void client.deactivate();
    };
  }, [userId]);
}
