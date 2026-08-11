import type { ReactNode } from 'react';
import { CalendarDays, CheckCircle2, ChevronDown, CircleEllipsis, Home, Map, MessageCircle, Settings, TicketCheck, Users, WalletCards, Wrench } from 'lucide-react';
import type { TripSummary } from '../api';
import type { WorkspacePage } from '../app/navigation';

type NavItem = { id: WorkspacePage; label: string; icon: typeof Home };
const primary: NavItem[] = [
  { id: 'home', label: '홈', icon: Home }, { id: 'schedule', label: '일정', icon: CalendarDays },
  { id: 'map', label: '지도', icon: Map }, { id: 'board', label: '보드', icon: MessageCircle },
];
const preparation: NavItem[] = [
  { id: 'info', label: '예약 / 정보', icon: TicketCheck }, { id: 'checklist', label: '체크리스트', icon: CheckCircle2 },
  { id: 'expenses', label: '비용', icon: WalletCards },
];
const mobile: NavItem[] = [...primary, { id: 'more', label: '더보기', icon: CircleEllipsis }];

export function WorkspaceShell({ trip, page, navigate, switchTrip, children }: {
  trip: TripSummary; page: WorkspacePage; navigate: (page: WorkspacePage) => void; switchTrip: () => void; children: ReactNode;
}) {
  const navButton = ({ id, label, icon: Icon }: NavItem) => <button className={page === id ? 'active' : ''} onClick={() => navigate(id)} key={id}><Icon />{label}</button>;
  return <div className="workspaceShell">
    <aside className="workspaceSidebar">
      <header><i>YS</i><b>Yang Sisters<small>Adventure</small></b></header>
      <button className="tripSwitcher" onClick={switchTrip}><span><small>CURRENT TRIP</small><b>{trip.name}</b><em>{trip.destination}</em></span><ChevronDown /></button>
      <nav>{primary.map(navButton)}<small>여행 준비</small>{preparation.map(navButton)}</nav>
      <footer><button onClick={() => navigate('more')}><Wrench />여행 도구</button><button onClick={() => navigate('more')}><Users />멤버</button><button onClick={() => navigate('more')}><Settings />여행 설정</button></footer>
    </aside>
    <section className="workspaceMain">
      <header className="workspaceTopbar"><div><small>{trip.country_code} · {trip.default_currency}</small><b>{trip.name}</b></div><time>{trip.start_date} — {trip.end_date}</time></header>
      <main className="content">{page === 'more' ? <MoreMenu navigate={navigate} /> : children}</main>
    </section>
    <nav className="mobileNav">{mobile.map(navButton)}</nav>
  </div>;
}

function MoreMenu({ navigate }: { navigate: (page: WorkspacePage) => void }) {
  return <section className="moreMenu"><header><small>TRAVEL TOOLBOX</small><h2>더보기</h2><p>여행 준비와 관리 기능을 한곳에서 열 수 있어요.</p></header><div>{preparation.map(({ id, label, icon: Icon }) => <button onClick={() => navigate(id)} key={id}><Icon /><span><b>{label}</b><small>열기</small></span></button>)}<button><Wrench /><span><b>여행 도구</b><small>준비 중</small></span></button><button><Users /><span><b>멤버</b><small>여행 선택 화면에서 관리</small></span></button><button><Settings /><span><b>여행 설정</b><small>준비 중</small></span></button></div></section>;
}
