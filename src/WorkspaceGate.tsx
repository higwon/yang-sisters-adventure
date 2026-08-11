import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { api, type TripSummary } from './api';
import { navigateToTrip, navigateToTrips, readWorkspacePath } from './app/navigation';
import { TripProvider } from './app/TripContext';

export function WorkspaceGate({ children }: { children: ReactNode }) {
  const [trips, setTrips] = useState<TripSummary[]>(); const [selected, setSelected] = useState<TripSummary>(); const [creating, setCreating] = useState(false); const [error, setError] = useState('');
  const reload = () => api.trips().then(({ trips: rows }) => setTrips(rows)).catch((reason: Error) => setError(reason.message));
  const openTrip = (trip: TripSummary) => { api.setTrip(trip.id); setSelected(trip); navigateToTrip(trip.id); };
  const updateCurrentTrip = (changes: Partial<TripSummary>) => { setSelected((current) => current ? { ...current, ...changes } : current); setTrips((current) => current?.map((trip) => trip.id === selected?.id ? { ...trip, ...changes } : trip)); };
  useEffect(() => { reload(); }, []);
  useEffect(() => { if (!trips) return; const syncPath = () => { const route = readWorkspacePath(); const trip = route ? trips.find((item) => item.id === route.tripId) : undefined; api.setTrip(trip?.id ?? null); setSelected(trip); if (route && !trip) navigateToTrips(true); }; syncPath(); window.addEventListener('popstate', syncPath); return () => window.removeEventListener('popstate', syncPath); }, [trips]);
  if (selected) return <TripProvider value={selected} updateCurrentTrip={updateCurrentTrip}>{children}</TripProvider>;
  if (!trips) return <div className="workspacePage"><p>여행을 불러오고 있어요…</p></div>;
  return <main className="workspacePage"><section className="workspaceChooser"><header><div><small>YANG SISTERS ADVENTURE</small><h1>내 여행</h1><p>함께 준비할 여행을 선택하세요.</p></div><button className="primary" onClick={() => setCreating(true)}><Plus />새 여행</button></header>{error && <p className="errorText">{error}</p>}<div className="tripGrid">{trips.map((trip) => <article key={trip.id}><button className="tripSelect" onClick={() => openTrip(trip)}><small>{trip.role === 'owner' ? 'OWNER' : 'MEMBER'}</small><h2>{trip.name}</h2><p>{trip.destination}</p><time>{trip.start_date} — {trip.end_date}</time></button></article>)}</div>{!trips.length && <div className="emptyWorkspace"><h2>아직 여행이 없어요.</h2><p>새 여행을 만들거나 Owner에게 멤버 추가를 요청하세요.</p></div>}{creating && <CreateTrip close={() => setCreating(false)} done={(trip) => { setTrips([trip, ...trips]); setCreating(false); openTrip(trip); }} />}</section></main>;
}

function CreateTrip({ close, done }: { close: () => void; done: (trip: TripSummary) => void }) {
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setError(''); const values = Object.fromEntries(new FormData(event.currentTarget)); try { done((await api.createTrip({ name: String(values.name), destination: String(values.destination), country_code: '', start_date: String(values.start_date), end_date: String(values.end_date), timezone: '' })).trip); } catch (reason) { setError(reason instanceof Error ? reason.message : '여행을 만들지 못했습니다.'); } };
  return <div className="backdrop" onMouseDown={close}><section className="modal" onMouseDown={(event) => event.stopPropagation()}><header><h2>새 여행</h2><button onClick={close}>×</button></header><form onSubmit={submit}><label>여행 이름<input name="name" required /></label><label>목적지<input name="destination" required /></label><div className="formRow"><label>시작일<input name="start_date" type="date" required /></label><label>종료일<input name="end_date" type="date" required /></label></div>{error && <p className="errorText">{error}</p>}<button className="primary">여행 만들기</button></form></section></div>;
}
