import { useEffect, useState, type ReactNode } from 'react';
import { api, type AuthUser } from './api';

export function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>();
  const authError = new URLSearchParams(window.location.search).get('auth_error');
  const error = authError === 'not_configured'
    ? 'Google 로그인이 아직 설정되지 않았습니다.'
    : authError ? 'Google 로그인에 실패했습니다. 다시 시도해 주세요.' : '';

  useEffect(() => { api.me().then(({ user: current }) => setUser(current)).catch(() => setUser(null)); }, []);
  if (user === undefined) return <div className="authPage"><p>로그인 정보를 확인하고 있어요…</p></div>;
  if (user) return <><button className="logoutButton" onClick={async () => { await api.logout(); setUser(null); }}>로그아웃</button>{children}</>;

  return <main className="authPage"><section className="authCard"><small>YANG SISTERS ADVENTURE</small><h1>로그인</h1><p>Google 계정으로 여행 공간에 참여하세요.</p>{error && <p className="errorText">{error}</p>}<a className="googleLogin" href="/api/auth/google"><span aria-hidden="true">G</span>Google로 로그인</a></section></main>;
}
