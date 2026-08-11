import { api } from '../api';
import './avatar.css';

export function UserAvatar({ user, className = '' }: { user: { id: number; name: string; avatar_color: string; avatar_key?: string | null }; className?: string }) {
  const src = api.avatarUrl(user.id, user.avatar_key);
  return <span className={`userAvatar ${className}`} style={{ background: user.avatar_color }}>{src && <img src={src} alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}<i>{user.name.slice(0, 1)}</i></span>;
}
