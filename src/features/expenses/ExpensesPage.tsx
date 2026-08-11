import { useEffect, useState, type FormEvent } from 'react';
import { MoreHorizontal, Pencil, Plus, Trash2, WalletCards, X } from 'lucide-react';
import { api } from '../../api';
import { formatKrw, type Expense, type Member } from '../../domain';
import './expenses.css';

const categories = ['항공', '숙소', '교통', '식사', '투어', '쇼핑', '기타'] as const;
const today = () => new Date().toISOString().slice(0, 10);

export function ExpensesPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.expenses>> | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [editing, setEditing] = useState<Expense | null | undefined>(undefined);
  const [error, setError] = useState('');
  const load = () => Promise.all([api.expenses(), api.dashboard()]).then(([expenses, dashboard]) => { setData(expenses); setMembers(dashboard.members); });
  useEffect(() => { load().catch((reason: Error) => setError(reason.message)); }, []);
  if (error) return <div className="expenseState">{error}</div>;
  if (!data) return <div className="expenseState">비용을 불러오는 중…</div>;
  return <section className="expensePage">
    <header className="expenseHeader"><div><h1>여행 비용</h1><p>이번 여행에 사용한 원화 금액을 간단히 기록해요.</p></div><button className="expenseAdd" onClick={() => setEditing(null)}><Plus />비용 추가</button></header>
    <section className="expenseTotal"><span><WalletCards /><small>총 지출</small></span><strong>{formatKrw(data.total_minor)}</strong></section>
    {data.legacy_count > 0 && <p className="legacyExpense">원화가 아닌 기존 비용 {data.legacy_count}건은 총액에서 제외했어요.</p>}
    <div className="expenseRows">
      {data.expenses.map((item) => <article key={item.id}>
        <time>{item.expense_date.slice(5).replace('-', '.')}</time>
        <div><b>{item.title}</b><small>{item.category} · {item.payer_name} 결제</small>{item.notes && <p>{item.notes}</p>}</div>
        <strong>{formatKrw(item.amount_minor)}</strong>
        <details><summary aria-label="비용 메뉴"><MoreHorizontal /></summary><div><button onClick={() => setEditing(item)}><Pencil />수정</button><button onClick={async () => { if (confirm('이 비용을 삭제할까요?')) { await api.remove('expenses', item.id); await load(); } }}><Trash2 />삭제</button></div></details>
      </article>)}
      {!data.expenses.length && <div className="expenseEmpty"><WalletCards /><b>아직 기록한 비용이 없어요</b><span>첫 비용을 가볍게 추가해 보세요.</span></div>}
    </div>
    {editing !== undefined && <ExpenseEditor item={editing} members={members} close={() => setEditing(undefined)} saved={async () => { setEditing(undefined); await load(); }} />}
  </section>;
}

function ExpenseEditor({ item, members, close, saved }: { item: Expense | null; members: Member[]; close: () => void; saved: () => Promise<void> }) {
  const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setError('');
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const payload = { title: String(values.title), amount_minor: Number(values.amount_minor), expense_date: String(values.expense_date), category: String(values.category), paid_by: Number(values.paid_by), notes: String(values.notes || '').trim() || null };
    try { if (item) await api.update('expenses', item.id, payload); else await api.create('expenses', payload); await saved(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '비용을 저장하지 못했습니다.'); setSaving(false); }
  };
  return <div className="backdrop" onMouseDown={close}><section className="modal expenseEditor" onMouseDown={(event) => event.stopPropagation()}><header><div><small>{item ? 'EDIT EXPENSE' : 'NEW EXPENSE'}</small><h2>{item ? '비용 수정' : '비용 추가'}</h2></div><button onClick={close}><X /></button></header><form onSubmit={submit}>
    <label>항목명<input name="title" defaultValue={item?.title} required /></label>
    <label>금액 (원)<input name="amount_minor" type="number" min="1" step="1" defaultValue={item?.amount_minor} placeholder="48000" required /></label>
    <div className="formRow"><label>날짜<input name="expense_date" type="date" defaultValue={item?.expense_date ?? today()} required /></label><label>카테고리<select name="category" defaultValue={item?.category ?? '식사'}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label></div>
    <label>결제자<select name="paid_by" defaultValue={item?.paid_by}>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
    <label>메모 (선택)<textarea name="notes" defaultValue={item?.notes ?? ''} rows={3} placeholder="현지 결제 정보가 필요하면 자유롭게 적어주세요." /></label>
    {error && <p className="errorText">{error}</p>}<button className="primary" disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
  </form></section></div>;
}
