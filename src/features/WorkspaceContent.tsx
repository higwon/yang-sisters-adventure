import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../api';
import type { WorkspacePage } from '../app/navigation';
import { calculateSettlements, type Currency, type Member, type Reservation } from '../domain';
import { SchedulePage } from './schedule/SchedulePage';
import { BoardPage } from './board/BoardPage';
import { HomePage as CollaborativeHomePage } from './home/HomePage';
import { MapPage } from './map/MapPage';

const minorDigits = (currency: Currency) => currency === 'PHP' ? 2 : 0;
const toMinor = (value: string, currency: Currency) => Math.round(Number(value) * 10 ** minorDigits(currency));
const money = (amountMinor: number, currency: Currency) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency, maximumFractionDigits: minorDigits(currency) }).format(amountMinor / 10 ** minorDigits(currency));

function Load<T>({ fn, children }: { fn: () => Promise<T>; children: (data: T, reload: () => void) => ReactNode }) {
  const [data, setData] = useState<T>(); const [error, setError] = useState(''); const [version, setVersion] = useState(0);
  useEffect(() => { setError(''); fn().then(setData).catch((reason: Error) => setError(reason.message)); }, [version]);
  if (error) return <div className="state">{error}<button onClick={() => setVersion(version + 1)}>다시 시도</button></div>;
  return data ? children(data, () => setVersion(version + 1)) : <div className="state">여행 정보를 불러오는 중…</div>;
}

function Heading({ title, add }: { title: string; add?: () => void }) { return <header className="head"><h2>{title}</h2>{add && <button onClick={add}><Plus />추가</button>}</header>; }
function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) { return <div className="backdrop" onMouseDown={close}><section className="modal" onMouseDown={(event) => event.stopPropagation()}><header><h2>{title}</h2><button onClick={close}>×</button></header>{children}</section></div>; }
const Field = ({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) => <label>{label}<input required {...props} /></label>;
const Select = ({ label, children, ...props }: { label: string; children: ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) => <label>{label}<select {...props}>{children}</select></label>;
const submit = (resource: string, close: () => void, reload: () => void, map?: (values: Record<string, FormDataEntryValue>) => unknown) => async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); await api.create(resource, map ? map(values) : values); close(); reload(); };

function HomePage() { return <CollaborativeHomePage />; }

function PlacesPage() { return <MapPage />; }

function ChecklistPage() { const [open, setOpen] = useState(false); return <Load fn={api.dashboard}>{(dashboard) => <Load fn={api.checklist}>{(items, reload) => <><Heading title="여행 준비" add={() => setOpen(true)} /><section className="checks">{items.map((item) => <label className={item.is_completed ? 'done' : ''} key={item.id}><input type="checkbox" checked={Boolean(item.is_completed)} onChange={async (event) => { await api.update('checklist', item.id, { is_completed: event.target.checked ? 1 : 0 }); reload(); }} /><span><b>{item.title}</b><small>{item.assignee_name ?? '담당자 미정'} · {item.due_date ?? '마감일 없음'}</small></span><em>{item.category}</em></label>)}</section>{open && <Modal title="준비 항목 추가" close={() => setOpen(false)}><form onSubmit={submit('checklist', () => setOpen(false), reload, (x) => ({ ...x, assignee_id: x.assignee_id ? Number(x.assignee_id) : null, due_date: x.due_date || null, is_completed: 0 }))}><Field label="할 일" name="title" /><Select label="담당자" name="assignee_id"><option value="">미정</option>{dashboard.members.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}</Select><Select label="카테고리" name="category"><option>예약</option><option>준비물</option><option>통신</option><option>금융</option></Select><Field label="마감일" name="due_date" type="date" required={false} /><button className="primary">저장</button></form></Modal>}</>}</Load>}</Load>; }

function ExpensesPage() { const [open, setOpen] = useState(false); return <Load fn={api.dashboard}>{(dashboard) => <Load fn={api.expenses}>{(items, reload) => <><Heading title="여행 비용" add={() => setOpen(true)} /><div className="totals">{(['KRW', 'PHP'] as const).map((currency) => <article key={currency}><small>{currency} 사용액</small><b>{money(items.filter((item) => item.currency === currency).reduce((sum, item) => sum + item.amount_minor, 0), currency)}</b></article>)}</div><section className="expenseList">{items.map((item) => <article key={item.id}><div><b>{item.title}</b><small>{item.expense_date} · {item.payer_name} 결제 · {item.participants.map((person) => person.name).join(', ')}</small></div><strong>{money(item.amount_minor, item.currency)}</strong><button className="delete" onClick={async () => { if (confirm('비용을 삭제할까요?')) { await api.remove('expenses', item.id); reload(); } }}><Trash2 size={15} /></button></article>)}</section><section className="settle"><h3>정산 미리보기</h3>{(['KRW', 'PHP'] as const).flatMap((currency) => calculateSettlements(items, currency)).map((settlement, index) => <p key={index}>{dashboard.members.find((member) => member.id === settlement.from)?.name} → {dashboard.members.find((member) => member.id === settlement.to)?.name}<b>{money(settlement.amount_minor, settlement.currency)}</b></p>)}</section>{open && <ExpenseForm members={dashboard.members} close={() => setOpen(false)} reload={reload} />}</>}</Load>}</Load>; }

function ExpenseForm({ members, close, reload }: { members: Member[]; close: () => void; reload: () => void }) {
  const [participants, setParticipants] = useState(members.map((member) => member.id));
  const [currency, setCurrency] = useState<Currency>('KRW');
  return <Modal title="비용 추가" close={close}><form onSubmit={submit('expenses', close, reload, (x) => ({ ...x, amount_minor: toMinor(String(x.amount), currency), currency, paid_by: Number(x.paid_by), participant_ids: participants }))}><Field label="항목명" name="title" /><Field label={`금액 (${currency})`} name="amount" type="number" min="0.01" step={currency === 'PHP' ? '0.01' : '1'} /><label>통화<select value={currency} onChange={(event) => setCurrency(event.target.value as Currency)}><option>KRW</option><option>PHP</option></select></label><Select label="결제자" name="paid_by">{members.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}</Select><fieldset><legend>참여자</legend>{members.map((member) => <label className="check" key={member.id}><input type="checkbox" checked={participants.includes(member.id)} onChange={(event) => setParticipants(event.target.checked ? [...participants, member.id] : participants.filter((id) => id !== member.id))} />{member.name}</label>)}</fieldset>{participants.length === 0 && <p className="errorText">참여자를 한 명 이상 선택해 주세요.</p>}<Field label="날짜" name="expense_date" type="date" /><Select label="카테고리" name="category"><option>숙소</option><option>식사</option><option>교통</option><option>투어</option><option>기타</option></Select><button className="primary" disabled={!participants.length}>저장</button></form></Modal>;
}

function InfoPage() { const [open, setOpen] = useState(false); return <Load fn={api.reservations}>{(items, reload) => <><Heading title="예약과 정보" add={() => setOpen(true)} /><div className="grid">{items.map((item: Reservation) => <article className="card" key={item.id}><small>{item.type}</small><h3>{item.title}</h3><p>{item.reservation_date}{item.confirmation_number && ` · ${item.confirmation_number}`}</p><button className="delete" onClick={async () => { if (confirm('예약 정보를 삭제할까요?')) { await api.remove('reservations', item.id); reload(); } }}><Trash2 size={15} /></button></article>)}</div>{open && <Modal title="예약 정보 추가" close={() => setOpen(false)}><form onSubmit={submit('reservations', () => setOpen(false), reload, (x) => ({ ...x, reservation_date: x.reservation_date || null, confirmation_number: x.confirmation_number || null }))}><Field label="제목" name="title" /><Select label="유형" name="type"><option>항공</option><option>숙소</option><option>투어</option><option>교통</option><option>eSIM</option><option>보험</option></Select><Field label="날짜" name="reservation_date" type="date" required={false} /><Field label="예약번호" name="confirmation_number" required={false} /><button className="primary">저장</button></form></Modal>}</>}</Load>; }

function ComingSoon({ title, issue }: { title: string; issue: number }) { return <section className="comingSoon"><small>COLLABORATION SPACE</small><h2>{title}</h2><p>기본 탐색 구조를 먼저 준비했어요. 기능은 Issue #{issue}에서 연결합니다.</p></section>; }

export function WorkspaceContent({ page }: { page: WorkspacePage }) {
  const views: Record<WorkspacePage, ReactNode> = {
    home: <HomePage />, schedule: <SchedulePage />, map: <PlacesPage />, board: <BoardPage />,
    checklist: <ChecklistPage />, expenses: <ExpensesPage />, info: <InfoPage />, more: <ComingSoon title="여행 도구" issue={3} />,
  };
  return <>{views[page]}</>;
}
