import { useState } from "react";
import { api, qc } from "./api";
export default function FriendsPage({
  friends,
  create,
  setError,
}: {
  friends: any;
  create: (ids: number[]) => void;
  setError: (s: string) => void;
}) {
  const [selected, setSelected] = useState<number[]>([]),
    [found, setFound] = useState<any[] | null>(null);
  return (
    <section>
      <h2>친구 {friends.data?.length ?? 0}</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const v = new FormData(e.currentTarget).get("login");
          try {
            setFound(
              await api("/users?login=" + encodeURIComponent(String(v))),
            );
          } catch (e) {
            setError(String(e));
          }
        }}
      >
        <input name="login" placeholder="정확한 아이디 검색" required />
        <button>검색</button>
      </form>
      {found?.length === 0 && <p>검색 결과가 없습니다.</p>}
      {found?.map((f) => (
        <p key={f.id}>
          {f.nickname}{" "}
          <button
            onClick={async () => {
              try {
                await api("/friends", { id: f.id });
                qc.invalidateQueries({ queryKey: ["friends"] });
                setFound(null);
              } catch (e) {
                setError(String(e));
              }
            }}
          >
            추가
          </button>
        </p>
      ))}
      {friends.data?.map((f: any) => (
        <div className="person" key={f.id}>
          <input
            type="checkbox"
            checked={selected.includes(f.id)}
            onChange={(e) =>
              setSelected((s) =>
                e.target.checked ? [...s, f.id] : s.filter((x) => x !== f.id),
              )
            }
          />
          <span>
            {f.nickname}
            <small>@{f.login}</small>
          </span>
          <button onClick={() => create([f.id])}>대화</button>
        </div>
      ))}
      {!friends.data?.length && <p>아이디로 첫 친구를 찾아보세요.</p>}
      <button disabled={selected.length < 2} onClick={() => create(selected)}>
        선택한 친구와 그룹 대화
      </button>
    </section>
  );
}
