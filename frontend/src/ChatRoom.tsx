import React from "react";
import { api } from "./api";
import { useConversation } from "./useConversation";
import type { NavigateFunction } from "react-router-dom";
export default function ChatRoom({
  room,
  me,
  rooms,
  nav,
  conversation,
  setError,
}: {
  room: string | undefined;
  me: any;
  rooms: any;
  nav: NavigateFunction;
  conversation: ReturnType<typeof useConversation>;
  setError: (s: string) => void;
}) {
  const {
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
  } = conversation;
  return (
    <main>
      {room ? (
        <>
          <header>
            <button onClick={() => nav("/")}>‹</button>
            <strong>
              {rooms.data?.find((r: any) => String(r.id) === room)?.title ??
                "대화"}
            </strong>
            <small>{members.length}명</small>
          </header>
          <div
            className="messages"
            ref={scroll}
            onScroll={async () => {
              const el = scroll.current!;
              bottom.current =
                el.scrollHeight - el.scrollTop - el.clientHeight < 60;
              if (bottom.current) {
                setFresh(false);
                markRead();
              }
              if (el.scrollTop === 0 && messages.length) {
                const height = el.scrollHeight;
                const target = room;
                try {
                  const rows = await api(
                    `/rooms/${room}/messages?beforeSeq=${messages[0].seq}`,
                  );
                  if (active.current === target) {
                    merge(rows);
                    requestAnimationFrame(() => {
                      el.scrollTop = el.scrollHeight - height;
                    });
                  }
                } catch (e) {
                  setError(String(e));
                }
              }
            }}
          >
            {[...messages, ...pending].map((m, i, all) => (
              <React.Fragment key={m.client_id}>
                {(i === 0 ||
                  new Date(m.sent_at).toDateString() !==
                    new Date(all[i - 1].sent_at).toDateString()) && (
                  <div className="date">
                    {new Date(m.sent_at).toLocaleDateString()}
                  </div>
                )}
                <article className={m.sender === me.data.id ? "mine" : ""}>
                  <small>
                    {m.nickname ??
                      members.find((x) => x.usr === m.sender)?.nickname ??
                      me.data.nickname}
                  </small>
                  <div className="bubble">{m.body}</div>
                  <small>
                    {m.seq === 0 ? (
                      m.failed ? (
                        <button onClick={() => send(m)}>실패 · 재시도</button>
                      ) : (
                        "전송 중"
                      )
                    ) : (
                      <>
                        {m.sender === me.data.id &&
                          (members.filter(
                            (x) => x.usr !== m.sender && x.last_read < m.seq,
                          ).length ||
                            "")}{" "}
                        ·{" "}
                        {new Date(m.sent_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </>
                    )}
                  </small>
                </article>
              </React.Fragment>
            ))}
          </div>
          {fresh && (
            <button
              onClick={() => {
                bottom.current = true;
                scroll.current?.scrollTo(0, scroll.current.scrollHeight);
                setFresh(false);
                markRead();
              }}
            >
              새 메시지 ↓
            </button>
          )}
          <footer>
            <textarea
              placeholder="메시지를 입력하세요"
              value={draft}
              maxLength={2000}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing &&
                  e.keyCode !== 229
                ) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <button disabled={!draft.trim()} onClick={() => send()}>
              전송
            </button>
          </footer>
        </>
      ) : (
        <div className="empty">
          <div className="logo">◒</div>
          <h2>마음이 오가는 자리</h2>
          <p>친구를 선택하고 도란도란 이야기해요.</p>
        </div>
      )}
    </main>
  );
}
