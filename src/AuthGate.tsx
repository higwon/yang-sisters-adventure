import { useEffect, useState, type ReactNode } from 'react';
import { api, type AuthUser, type SelectableProfile } from './api';

export function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>();
  const [profiles, setProfiles] = useState<SelectableProfile[]>();
  const [error, setError] = useState('');
  const [pendingId, setPendingId] = useState<number>();

  useEffect(() => {
    api.me()
      .then(({ user: current }) => setUser(current))
      .catch(() => api.profiles().then(({ profiles: fixedProfiles }) => { setUser(null); setProfiles(fixedProfiles); }))
      .catch(() => { setUser(null); setProfiles([]); setError('프로필을 불러오지 못했습니다.'); });
  }, []);
  if (user === undefined) return <div className="authPage"><p>로그인 정보를 확인하고 있어요…</p></div>;
  if (user) return <><button className="logoutButton" onClick={async () => { await api.logout(); setProfiles(undefined); setUser(undefined); api.profiles().then(({ profiles: fixedProfiles }) => { setProfiles(fixedProfiles); setUser(null); }); }}>프로필 변경</button>{children}</>;

  const select = async (profile: SelectableProfile) => {
    setPendingId(profile.id); setError('');
    try { setUser((await api.selectProfile(profile.id)).user); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '프로필을 선택하지 못했습니다.'); setPendingId(undefined); }
  };

  return <main className="profilePage"><section className="profileChooser"><small>YANG SISTERS ADVENTURE</small><h1>누가 여행을 준비하나요?</h1><p>사용할 프로필을 선택하세요.</p>{error && <p className="errorText">{error}</p>}<div className="profileGrid">{profiles?.map((profile) => <button key={profile.id} onClick={() => select(profile)} disabled={pendingId !== undefined}><span style={{ background: profile.avatar_color }}>{profile.name.slice(0, 1)}</span><b>{profile.name}</b>{pendingId === profile.id && <small>접속 중…</small>}</button>)}</div></section></main>;
}
