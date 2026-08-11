import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api, type AuthUser } from './api';

export function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>();
  const [error, setError] = useState('');

  useEffect(() => { api.me().then(({ user: current }) => setUser(current)).catch(() => setUser(null)); }, []);
  if (user === undefined) return <div className="authPage"><p>로그인 정보를 확인하고 있어요…</p></div>;
  if (user) return <><button className="logoutButton" onClick={async () => { await api.logout(); setUser(null); }}>로그아웃</button>{children}</>;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await api.login(String(values.login_identifier), String(values.password));
      setUser(result.user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '로그인하지 못했습니다.');
    }
  };

  return <main className="authPage"><section className="authCard"><small>YANG SISTERS ADVENTURE</small><h1>로그인</h1><p>발급받은 아이디와 비밀번호를 입력하세요.</p><form onSubmit={submit}><label>아이디<input name="login_identifier" autoComplete="username" required /></label><label>비밀번호<input name="password" type="password" autoComplete="current-password" required /></label>{error && <p className="errorText">{error}</p>}<button className="primary">로그인</button></form></section></main>;
}
