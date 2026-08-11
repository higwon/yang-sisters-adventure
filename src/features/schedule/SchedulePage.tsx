import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Clock3, Link, MapPin, Plus, Trash2, Users } from 'lucide-react';
import { api } from '../../api';
import { useTrip } from '../../app/TripContext';
import type { Dashboard, Place, ScheduleItem } from '../../domain';

const categories = ['항공', '이동', '숙소', '관광', '식사', '쇼핑', '기타'];
const dayMs = 86_400_000;
const toDate = (value: string) => new Date(`${value}T00:00:00`);
const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const formatDay = (date: string) => new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' }).format(toDate(date));
const tripDates = (start: string, end: string) => Array.from({ length: Math.round((toDate(end).getTime() - toDate(start).getTime()) / dayMs) + 1 }, (_, index) => isoDate(new Date(toDate(start).getTime() + index * dayMs)));
const minutes = (time: string | null, fallback: number) => time ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) : fallback;
const categoryClass = (category: string) => `tone${Math.abs([...category].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % 5}`;

function Load<T>({ fn, children }: { fn: () => Promise<T>; children: (data: T, reload: () => void) => ReactNode }) {
  const [data, setData] = useState<T>(); const [error, setError] = useState(''); const [version, setVersion] = useState(0);
  useEffect(() => { fn().then(setData).catch((reason: Error) => setError(reason.message)); }, [fn, version]);
  if (error) return <div className="state">{error}<button onClick={() => setVersion(version + 1)}>다시 시도</button></div>;
  return data ? children(data, () => setVersion(version + 1)) : <div className="state">일정을 불러오는 중…</div>;
}

type Draft = { item?: ScheduleItem; dayDate: string; startTime?: string };

export function SchedulePage() {
  const trip = useTrip();
  return <Load fn={api.dashboard}>{(dashboard) => <Load fn={api.places}>{(places) => <Load fn={api.schedule}>{(items, reload) =>
    <ScheduleWorkspace tripDates={tripDates(trip.start_date, trip.end_date)} dashboard={dashboard} places={places} items={items} reload={reload} />
  }</Load>}</Load>}</Load>;
}

function ScheduleWorkspace({ tripDates: dates, dashboard, places, items, reload }: { tripDates: string[]; dashboard: Dashboard; places: Place[]; items: ScheduleItem[]; reload: () => void }) {
  const [selectedDate, setSelectedDate] = useState(dates[0]); const [draft, setDraft] = useState<Draft>();
  const grouped = useMemo(() => Object.fromEntries(dates.map((date) => [date, items.filter((item) => item.day_date === date)])), [dates, items]);
  const selectedIndex = Math.max(0, dates.indexOf(selectedDate));
  const openSlot = (date: string, hour = 9) => setDraft({ dayDate: date, startTime: `${String(hour).padStart(2, '0')}:00` });
  return <section className="scheduleWorkspace">
    <header className="scheduleHeader"><div><small>전체 일정</small><h2>날짜를 넘나들며 한눈에 계획하세요</h2><p>빈 시간을 눌러 추가하고, 일정 카드를 눌러 바로 수정할 수 있어요.</p></div><button className="scheduleAdd" onClick={() => openSlot(selectedDate)}><Plus size={18} />일정 추가</button></header>
    <nav className="mobileDayTabs" aria-label="여행 날짜">{dates.map((date, index) => <button key={date} className={date === selectedDate ? 'active' : ''} onClick={() => setSelectedDate(date)}><b>DAY {index + 1}</b><span>{formatDay(date)}</span></button>)}</nav>
    <div className="desktopItinerary" style={{ '--days': dates.length } as CSSProperties}>
      <div className="itineraryHeader"><span />{dates.map((date, index) => <button key={date} onClick={() => { setSelectedDate(date); openSlot(date); }}><b>DAY {index + 1}</b><span>{formatDay(date)}</span><em>{grouped[date].length}개 일정</em></button>)}</div>
      <div className="itineraryBody"><aside>{Array.from({ length: 17 }, (_, i) => <time key={i}>{String(i + 7).padStart(2, '0')}:00</time>)}</aside>{dates.map((date) => <DayColumn key={date} items={grouped[date]} open={(hour) => openSlot(date, hour)} edit={(item) => setDraft({ item, dayDate: date })} />)}</div>
    </div>
    <div className="mobileTimeline"><header><button disabled={selectedIndex === 0} onClick={() => setSelectedDate(dates[selectedIndex - 1])}><ChevronLeft /></button><div><b>{formatDay(selectedDate)}</b><small>DAY {selectedIndex + 1}</small></div><button disabled={selectedIndex === dates.length - 1} onClick={() => setSelectedDate(dates[selectedIndex + 1])}><ChevronRight /></button></header>{grouped[selectedDate].length ? grouped[selectedDate].map((item) => <MobileItem key={item.id} item={item} edit={() => setDraft({ item, dayDate: selectedDate })} />) : <button className="emptyDay" onClick={() => openSlot(selectedDate)}><Plus />아직 일정이 없어요. 첫 일정을 추가해 보세요.</button>}<button className="floatingAdd" onClick={() => openSlot(selectedDate)} aria-label="일정 추가"><Plus /></button></div>
    {draft && <ScheduleEditor draft={draft} dates={dates} places={places} dashboard={dashboard} close={() => setDraft(undefined)} reload={reload} />}
  </section>;
}

function DayColumn({ items, open, edit }: { items: ScheduleItem[]; open: (hour: number) => void; edit: (item: ScheduleItem) => void }) {
  return <section className="dayColumn">{Array.from({ length: 17 }, (_, i) => <button key={i} className="timeSlot" onClick={() => open(i + 7)} aria-label={`${i + 7}시 일정 추가`} />)}{items.map((item) => { const top = (minutes(item.start_time, 7 * 60) - 7 * 60) / 60 * 64; const height = Math.max(46, (minutes(item.end_time, minutes(item.start_time, 7 * 60) + 60) - minutes(item.start_time, 7 * 60)) / 60 * 64); return <button key={item.id} className={`scheduleBlock ${categoryClass(item.category)} ${item.status === 'candidate' ? 'candidate' : ''}`} style={{ top, height }} onClick={() => edit(item)}><small>{item.category}{item.status === 'candidate' ? ' · 후보' : ''}</small><b>{item.title}</b><time>{item.start_time ?? '시간 미정'}{item.end_time && ` – ${item.end_time}`}</time>{item.place_name && <span><MapPin />{item.place_name}</span>}</button>; })}</section>;
}

function MobileItem({ item, edit }: { item: ScheduleItem; edit: () => void }) {
  return <article className="mobileScheduleItem"><time>{item.start_time ?? '미정'}</time><i /><button className={categoryClass(item.category)} onClick={edit}><small>{item.category}{item.status === 'candidate' ? ' · 후보' : ''}</small><b>{item.title}</b><span><Clock3 />{item.start_time ?? '시간 미정'}{item.end_time && ` – ${item.end_time}`}</span>{item.place_name && <span><MapPin />{item.place_name}</span>}</button></article>;
}

function ScheduleEditor({ draft, dates, places, dashboard, close, reload }: { draft: Draft; dates: string[]; places: Place[]; dashboard: Dashboard; close: () => void; reload: () => void }) {
  const item = draft.item; const [participants, setParticipants] = useState(item?.participants.map((person) => person.id) ?? dashboard.members.map((member) => member.id)); const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setSaving(true); setError(''); const values = Object.fromEntries(new FormData(event.currentTarget)); const payload = { title: values.title, day_date: values.day_date, start_time: values.start_time || null, end_time: values.end_time || null, place_id: values.place_id ? Number(values.place_id) : null, category: values.category, notes: values.notes || null, url: values.url || null, status: values.status, participant_ids: participants, sort_order: item?.sort_order ?? 0 }; try { if (item) await api.update('schedule', item.id, payload); else await api.create('schedule', payload); close(); reload(); } catch (reason) { setError(reason instanceof Error ? reason.message : '저장하지 못했습니다.'); setSaving(false); } };
  return <div className="backdrop" onMouseDown={close}><section className="modal scheduleEditor" onMouseDown={(event) => event.stopPropagation()}><header><div><small>{item ? '빠른 편집' : '새 일정'}</small><h2>{item ? item.title : '일정 추가'}</h2></div><button onClick={close}>×</button></header><form onSubmit={submit}><label>제목<input name="title" defaultValue={item?.title} required autoFocus /></label><div className="formRow"><label>날짜<select name="day_date" defaultValue={item?.day_date ?? draft.dayDate}>{dates.map((date, index) => <option value={date} key={date}>DAY {index + 1} · {formatDay(date)}</option>)}</select></label><label>상태<select name="status" defaultValue={item?.status ?? 'confirmed'}><option value="confirmed">확정</option><option value="candidate">후보</option></select></label></div><div className="formRow"><label>시작<input name="start_time" type="time" defaultValue={item?.start_time ?? draft.startTime} /></label><label>종료<input name="end_time" type="time" defaultValue={item?.end_time ?? ''} /></label></div><div className="formRow"><label>카테고리<select name="category" defaultValue={item?.category ?? '관광'}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label>장소<select name="place_id" defaultValue={item?.place_id ?? ''}><option value="">장소 미정</option>{places.map((place) => <option value={place.id} key={place.id}>{place.name}</option>)}</select></label></div><label><Link />관련 URL<input name="url" type="url" defaultValue={item?.url ?? ''} placeholder="https://" /></label><label>메모<textarea name="notes" defaultValue={item?.notes ?? ''} rows={3} /></label><fieldset><legend><Users /> 참여 멤버</legend>{dashboard.members.map((member) => <label className="check" key={member.id}><input type="checkbox" checked={participants.includes(member.id)} onChange={(event) => setParticipants(event.target.checked ? [...participants, member.id] : participants.filter((id) => id !== member.id))} /><i style={{ background: member.avatar_color }}>{member.name[0]}</i>{member.name}</label>)}</fieldset>{error && <p className="errorText">{error}</p>}<footer>{item && <button type="button" className="editorDelete" onClick={async () => { if (confirm('이 일정을 삭제할까요?')) { await api.remove('schedule', item.id); close(); reload(); } }}><Trash2 />삭제</button>}<button className="primary" disabled={saving}>{saving ? '저장 중…' : '저장'}</button></footer></form></section></div>;
}
