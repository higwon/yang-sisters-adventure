import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Plus, Settings, Trash2, Users } from 'lucide-react';
import { api, type SelectableProfile, type TripMember, type TripSummary } from './api';
import { navigateToTrip, navigateToTrips, readWorkspacePath } from './app/navigation';
import { TripProvider } from './app/TripContext';

export function WorkspaceGate({ children }: { children: ReactNode }) {
  const [trips, setTrips] = useState<TripSummary[]>();
  const [selected, setSelected] = useState<TripSummary>();
  const [creating, setCreating] = useState(false);
  const [managing, setManaging] = useState<TripSummary>();
  const [error, setError] = useState('');
  const reload = () => api.trips().then(({ trips: rows }) => setTrips(rows)).catch((reason: Error) => setError(reason.message));
  const openTrip = (trip: TripSummary) => { api.setTrip(trip.id); setSelected(trip); navigateToTrip(trip.id); };
  useEffect(() => { reload(); }, []);
  useEffect(() => {
    if (!trips) return;
    const syncPath = () => {
      const route = readWorkspacePath();
      const trip = route ? trips.find((item) => item.id === route.tripId) : undefined;
      api.setTrip(trip?.id ?? null);
      setSelected(trip);
      if (route && !trip) navigateToTrips(true);
    };
    syncPath();
    window.addEventListener('popstate', syncPath);
    return () => window.removeEventListener('popstate', syncPath);
  }, [trips]);
  if (selected) return <TripProvider value={selected}>{children}</TripProvider>;
  if (!trips) return <div className="workspacePage"><p>내 여행을 불러오고 있어요…</p></div>;
  return <main className="workspacePage"><section className="workspaceChooser"><header><div><small>YANG SISTERS ADVENTURE</small><h1>내 여행</h1><p>함께 준비할 여행을 선택하세요.</p></div><button className="primary" onClick={() => setCreating(true)}><Plus />새 여행</button></header>{error && <p className="errorText">{error}</p>}<div className="tripGrid">{trips.map((trip) => <article key={trip.id}><button className="tripSelect" onClick={() => openTrip(trip)}><small>{trip.role === 'owner' ? 'OWNER' : 'MEMBER'}</small><h2>{trip.name}</h2><p>{trip.destination}</p><time>{trip.start_date} — {trip.end_date}</time></button>{trip.role === 'owner' && <button className="tripManage" onClick={() => setManaging(trip)}><Settings size={16} />멤버 관리</button>}</article>)}</div>{trips.length === 0 && <div className="emptyWorkspace"><h2>아직 여행이 없어요</h2><p>새 여행을 만들거나 Owner에게 멤버 추가를 요청하세요.</p></div>}{creating && <CreateTrip close={() => setCreating(false)} done={(trip) => { setTrips([trip, ...trips]); setCreating(false); openTrip(trip); }} />}{managing && <MemberManager trip={managing} close={() => setManaging(undefined)} deleted={() => { setTrips(trips.filter((trip) => trip.id !== managing.id)); setManaging(undefined); }} />}</section></main>;
}

function CreateTrip({ close, done }: { close: () => void; done: (trip: TripSummary) => void }) {
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setError(''); const values = Object.fromEntries(new FormData(event.currentTarget)); try { done((await api.createTrip({ name: String(values.name), destination: String(values.destination), country_code: String(values.country_code), start_date: String(values.start_date), end_date: String(values.end_date), timezone: String(values.timezone) })).trip); } catch (reason) { setError(reason instanceof Error ? reason.message : '여행을 만들지 못했습니다.'); } };
  return <div className="backdrop" onMouseDown={close}><section className="modal" onMouseDown={(event) => event.stopPropagation()}><header><h2>새 여행</h2><button onClick={close}>×</button></header><form onSubmit={submit}><label>여행 이름<input name="name" required /></label><label>목적지<input name="destination" required /></label><label>국가 코드<input name="country_code" placeholder="예: PH" maxLength={2} required /></label><div className="formRow"><label>시작일<input name="start_date" type="date" required /></label><label>종료일<input name="end_date" type="date" required /></label></div><label>시간대<input name="timezone" defaultValue={Intl.DateTimeFormat().resolvedOptions().timeZone} required /></label>{error && <p className="errorText">{error}</p>}<button className="primary">여행 만들기</button></form></section></div>;
}

function MemberManager({ trip, close, deleted }: { trip: TripSummary; close: () => void; deleted: () => void }) {
  const [members, setMembers] = useState<TripMember[]>(); const [profiles, setProfiles] = useState<SelectableProfile[]>(); const [error, setError] = useState('');
  const reload = () => Promise.all([api.tripMembers(trip.id), api.profiles()]).then(([memberResult, profileResult]) => { setMembers(memberResult.members); setProfiles(profileResult.profiles); }).catch((reason: Error) => setError(reason.message));
  useEffect(() => { reload(); }, [trip.id]);
  return <div className="backdrop" onMouseDown={close}><section className="modal memberModal" onMouseDown={(event) => event.stopPropagation()}><header><h2><Users />{trip.name} 멤버</h2><button onClick={close}>×</button></header>{error && <p className="errorText">{error}</p>}<div className="memberList">{profiles?.map((profile) => { const member = members?.find((item) => item.id === profile.id); return <article key={profile.id}><i style={{ background: profile.avatar_color }}>{profile.name.slice(0, 1)}</i><span><b>{profile.name}</b><small>{member ? (member.role === 'owner' ? 'Owner' : '참여 중') : '참여 가능'}</small></span>{member?.role === 'member' ? <button onClick={async () => { await api.removeTripMember(trip.id, profile.id); reload(); }}><Trash2 size={16} />제거</button> : !member ? <button onClick={async () => { await api.addTripMember(trip.id, profile.id); reload(); }}><Plus size={16} />추가</button> : null}</article>; })}</div><button className="dangerButton" onClick={async () => { if (confirm('이 여행과 모든 데이터를 삭제할까요?')) { await api.deleteTrip(trip.id); deleted(); } }}>여행 삭제</button></section></div>;
}
