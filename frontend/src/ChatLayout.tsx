import { useMobile } from "./useMobile";
import FriendsPage from "./FriendsPage";
import ChatRoom from "./ChatRoom";
import { useConversation } from "./useConversation";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { api, qc, ApiError } from "./api";
import Auth from "./AuthPage";
import ProfilePage from "./ProfilePage";
export default function App() {
  const nav = useNavigate(),
    { room } = useParams();
  const [tab, setTab] = useState("채팅"),
    [status, setStatus] = useState("연결 중"),
    [error, setError] = useState("");
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api("/me"),
    retry: false,
  });
  const friends = useQuery({
    queryKey: ["friends"],
    queryFn: () => api("/friends"),
    enabled: !!me.data,
  });
  const rooms = useQuery({
    queryKey: ["rooms"],
    queryFn: () => api("/rooms"),
    enabled: !!me.data,
  });

  useMobile(me.data?.id);
  const conversation = useConversation(room, me, setError, setStatus);
  async function create(ids: number[]) {
    try {
      const r = await api("/rooms", {
        members: ids,
        title:
          ids.length > 1
            ? "함께 도란도란"
            : friends.data.find((f: any) => f.id === ids[0])?.nickname +
              "님과 대화",
      });
      nav("/rooms/" + r.id);
      setTab("채팅");

      qc.invalidateQueries({ queryKey: ["rooms"] });
    } catch (e) {
      setError(String(e));
    }
  }
  if (me.isPending) return <main className="auth">니랑내를 여는 중… 무료 서버의 첫 연결은 1분 이상 걸릴 수 있습니다.</main>;
  if(me.isError && !(me.error instanceof ApiError && me.error.status === 401))
    return <main className="auth"><p role="alert">{String(me.error)}</p><button onClick={() => me.refetch()}>연결 다시 시도</button></main>;
  if (!me.data)
    return <Auth done={() => qc.invalidateQueries({ queryKey: ["me"] })} />;
  return (
    <div className={"app " + (room ? "opened" : "")}>
      <aside>
        <h1>◒ 니랑내</h1>
        <p className="muted">가까운 마음, 도란도란</p>
        <nav>
          {["친구", "채팅", "내 정보"].map((t) => (
            <button
              className={tab === t ? "selected" : ""}
              onClick={() => {
                setTab(t);
                nav("/");
              }}
              key={t}
            >
              {t}
            </button>
          ))}
        </nav>
        <small>{status}</small>
        {error && (
          <p role="alert" onClick={() => setError("")}>
            {error}
          </p>
        )}
        {tab === "내 정보" ? (
          <ProfilePage me={me.data} />
        ) : tab === "친구" ? (
          <FriendsPage friends={friends} create={create} setError={setError} />
        ) : (
          <section>
            <h2>대화</h2>
            {rooms.data?.map((r: any) => (
              <button
                className={"room " + (String(r.id) === room ? "selected" : "")}
                key={r.id}
                onClick={() => nav("/rooms/" + r.id)}
              >
                <strong>{r.title}</strong>
                <time>
                  {r.activity
                    ? new Date(r.activity).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : ""}
                </time>
                <p>{r.last_message ?? "첫 인사를 건네보세요"}</p>
                {r.unread > 0 && <b>{r.unread}</b>}
              </button>
            ))}
            {!rooms.data?.length && <p>친구에게 첫 인사를 건네보세요.</p>}
          </section>
        )}
      </aside>
      <ChatRoom
        room={room}
        me={me}
        rooms={rooms}
        nav={nav}
        conversation={conversation}
        setError={setError}
      />
    </div>
  );
}
