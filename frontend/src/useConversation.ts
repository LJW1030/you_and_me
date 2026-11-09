import { useEffect, useRef, useState } from "react";
import {useRealtime} from "./useRealtime";
import { api, qc, token, csrf } from "./api";
type Msg = {
  seq: number;
  sender: number;
  client_id: string;
  body: string;
  sent_at: string;
  nickname?: string;
  failed?: boolean;
};
export function useConversation(
  room: string | undefined,
  me: any,
  setError: (s: string) => void,
  setStatus: (s: string) => void,
) {
  const [messages, setMessages] = useState<Msg[]>([]),
    [members, setMembers] = useState<any[]>([]),
    [draft, setDraft] = useState(""),
    [pending, setPending] = useState<Msg[]>([]),
    [fresh, setFresh] = useState(false);
  const scroll = useRef<HTMLDivElement>(null),
    bottom = useRef(true),
    cursor = useRef<number | null>(null),
    active = useRef(room),
    busy = useRef(false),
    again = useRef(false),
    read = useRef(0),
    ready = useRef(false);
  active.current = room;
  function merge(rows: Msg[]) {
    setMessages((old) =>
      Array.from(
        new Map([...old, ...rows].map((m) => [m.seq, m])).values(),
      ).sort((a, b) => a.seq - b.seq),
    );
    setPending((old) =>
      old.filter((p) => !rows.some((m) => m.client_id === p.client_id && m.sender === p.sender)),
    );
  }
  async function sync() {
    if (!active.current || !ready.current) return;
    if (busy.current) {
      again.current = true;
      return;
    }
    busy.current = true;
    const target = active.current;
    try {
      let rows: Msg[] = await api(
        `/rooms/${target}/messages` +
          (cursor.current === null ? "" : `?afterSeq=${cursor.current}`),
      );
      if (active.current !== target) return;
      if (cursor.current === null) {
        rows.sort((a, b) => a.seq - b.seq);
        cursor.current = rows.length ? rows[0].seq - 1 : 0;
      }
      while (true) {
        merge(rows);
        for (const m of rows)
          if (m.seq === cursor.current! + 1) cursor.current = m.seq;
        if (rows.length < 30) break;
        rows = await api(
          `/rooms/${target}/messages?afterSeq=${cursor.current}`,
        );
        if (active.current !== target) return;
      }
      const currentMembers = await api(`/rooms/${target}/members`);
      if(active.current !== target) return;
      setMembers(currentMembers);
      if (bottom.current) {
        requestAnimationFrame(() => {
          if(active.current !== target) return;
          scroll.current?.scrollTo(0, scroll.current.scrollHeight);
          markRead();
        });
      } else setFresh(true);
    } catch (e) {
      setError(String(e));
    } finally {
      busy.current = false;
      if (again.current) {
        again.current = false;
        void sync();
      }
    }
  }
  function markRead() {
    if (
      !document.hidden &&
      bottom.current &&
      active.current &&
      cursor.current !== null &&
      cursor.current > read.current
    ) {
      read.current = cursor.current;
      api(`/rooms/${active.current}/read`, { seq: read.current }).catch(() => {
        read.current = 0;
      });
    }
  }
  const syncRef = useRef(sync);
  syncRef.current = sync;
  useRealtime(me.data?.id, ready, syncRef, setStatus);
  useEffect(() => {
    setMessages([]);
    setPending([]);
    cursor.current = null;
    read.current = 0;
    bottom.current = true;
    setFresh(false);
    void syncRef.current();
  }, [room]);
  useEffect(() => {
    const f = () => markRead();
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  });
  async function send(m?: Msg) {
    const body = m?.body ?? draft;
    if (!body.trim() || body.length > 2000) return;
    const item = m ?? {
      seq: 0,
      sender: me.data.id,
      client_id: crypto.randomUUID(),
      body,
      sent_at: new Date().toISOString(),
    };
    if (!m) {
      setPending((p) => [...p, item]);
      setDraft("");
    } else
      setPending((p) =>
        p.map((x) =>
          x.client_id === m.client_id ? { ...x, failed: false } : x,
        ),
      );
    try {
      const target = room;
      const saved = await api(`/rooms/${room}/messages`, {
        clientMessageId: item.client_id,
        body,
      });
      if(active.current !== target) return;
      merge([saved]);
      void syncRef.current();
    } catch {
      setPending((p) =>
        p.map((x) =>
          x.client_id === item.client_id ? { ...x, failed: true } : x,
        ),
      );
    }
  }
  return {
    messages,
    members,
    draft,
    setDraft,
    pending,
    fresh,
    setFresh,
    scroll,
    bottom,
    active,
    merge,
    markRead,
    send,
  };
}
