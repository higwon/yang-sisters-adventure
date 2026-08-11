import type { ReactNode } from 'react';
import { CalendarDays, ChevronDown, Home, MessageCircle, Settings, WalletCards } from 'lucide-react';
import type { TripSummary } from '../api';
import type { WorkspacePage } from '../app/navigation';
import { useAuth } from '../AuthGate';
import { UserAvatar } from './UserAvatar';
import './workspace-shell.css';

type NavItem = { id: WorkspacePage; label: string; icon: typeof Home };
const navigation: NavItem[] = [
  { id: 'home', label: '홈', icon: Home }, { id: 'schedule', label: '일정', icon: CalendarDays },
  { id: 'board', label: '보드', icon: MessageCircle }, { id: 'expenses', label: '비용', icon: WalletCards },
];

export function WorkspaceShell({ trip, page, navigate, switchTrip, children }: { trip: TripSummary; page: WorkspacePage; navigate: (page: WorkspacePage) => void; switchTrip: () => void; children: ReactNode }) {
  const { user } = useAuth();
  const navButton = ({ id, label, icon: Icon }: NavItem) => <button className={page === id ? 'active' : ''} onClick={() => navigate(id)} key={id}><Icon />{label}</button>;
  return <div className="workspaceShell"><aside className="workspaceSidebar"><header><i>YS</i><b>Yang Sisters<small>Adventure</small></b></header><button className="tripSwitcher" onClick={switchTrip}><span><small>CURRENT TRIP</small><b>{trip.name}</b><em>{trip.destination}</em></span><ChevronDown /></button><nav>{navigation.map(navButton)}</nav><footer><button className={page === 'settings' ? 'active currentUserButton' : 'currentUserButton'} onClick={() => navigate('settings')}><UserAvatar user={user} /><span><b>{user.name}</b><small>내 프로필 · 설정</small></span><Settings /></button></footer></aside><section className="workspaceMain"><header className="workspaceTopbar"><div><small>{trip.country_code}</small><b>{trip.name}</b></div><button className="mobileCurrentUser" onClick={() => navigate('settings')}><UserAvatar user={user} /><span>{user.name}</span></button><time>{trip.start_date} — {trip.end_date}</time></header><main className="content">{children}</main></section><nav className="mobileNav">{navigation.map(navButton)}</nav></div>;
}
