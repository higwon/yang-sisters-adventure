import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api, type AuthUser } from './api';

export function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>();
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { api.me().then(({ user: current }) => setUser(current)).catch(() => setUser(null)); }, []);
  if (user === undefined) return <div className="authPage"><p>로그인 정보를 확인하고 있어요…</p></div>;
  if (user) return <><button className="logoutButton" onClick={async () => { await api.logout(); setUser(null); }}>로그아웃</button>{children}</>;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = registering
        ? await api.register(String(values.name), String(values.login_identifier), String(values.password))
        : await api.login(String(values.login_identifier), String(values.password));
      setUser(result.user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '로그인하지 못했습니다.');
    }
  };

  return <main className="authPage"><section className="authCard"><small>YANG SISTERS ADVENTURE</small><h1>{registering ? '함께 여행을 준비해요' : '다시 만나서 반가워요'}</h1><p>여행 일정과 준비 내용을 안전하게 공유하세요.</p><form onSubmit={submit}>{registering && <label>이름<input name="name" autoComplete="name" required /></label>}<label>로그인 아이디<input name="login_identifier" autoComplete="username" required minLength={3} /></label><label>비밀번호<input name="password" type="password" autoComplete={registering ? 'new-password' : 'current-password'} required minLength={10} /></label>{error && <p className="errorText">{error}</p>}<button className="primary">{registering ? '계정 만들기' : '로그인'}</button></form><button className="authSwitch" onClick={() => { setError(''); setRegistering(!registering); }}>{registering ? '이미 계정이 있어요' : '처음 방문했어요'}</button></section></main>;
}
