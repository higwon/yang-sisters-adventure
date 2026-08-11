import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type AuthUser, type SelectableProfile } from './api';
import { UserAvatar } from './components/UserAvatar';

type AuthState = { user: AuthUser; refreshUser: () => Promise<void>; switchProfile: () => Promise<void> };
const AuthContext = createContext<AuthState | null>(null);
export const useAuth = () => { const value = useContext(AuthContext); if (!value) throw new Error('AuthGate가 필요합니다.'); return value; };

export function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(); const [profiles, setProfiles] = useState<SelectableProfile[]>(); const [error, setError] = useState(''); const [pendingId, setPendingId] = useState<number>();
  const loadProfiles = () => api.profiles().then(({ profiles: rows }) => { setProfiles(rows); setUser(null); });
  const refreshUser = async () => setUser((await api.me()).user);
  const switchProfile = async () => { await api.logout(); await loadProfiles(); };
  useEffect(() => { api.me().then(({ user: current }) => setUser(current)).catch(loadProfiles).catch(() => { setUser(null); setProfiles([]); setError('프로필을 불러오지 못했습니다.'); }); }, []);
  const context = useMemo(() => user ? { user, refreshUser, switchProfile } : null, [user]);
  if (user === undefined) return <div className="authPage"><p>프로필을 확인하고 있어요…</p></div>;
  if (user && context) return <AuthContext.Provider value={context}>{children}</AuthContext.Provider>;
  const select = async (profile: SelectableProfile) => { setPendingId(profile.id); setError(''); try { setUser((await api.selectProfile(profile.id)).user); } catch (reason) { setError(reason instanceof Error ? reason.message : '프로필을 선택하지 못했습니다.'); setPendingId(undefined); } };
  return <main className="profilePage"><section className="profileChooser"><small>YANG SISTERS ADVENTURE</small><h1>누가 여행을 준비하나요?</h1><p>사용할 프로필을 선택하세요.</p>{error && <p className="errorText">{error}</p>}<div className="profileGrid">{profiles?.map((profile) => <button key={profile.id} onClick={() => select(profile)} disabled={pendingId !== undefined}><UserAvatar user={profile} /><b>{profile.name}</b>{pendingId === profile.id && <small>접속 중…</small>}</button>)}</div></section></main>;
}
