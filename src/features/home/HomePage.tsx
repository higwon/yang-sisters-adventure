import { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, Inbox, WalletCards } from 'lucide-react';
import { api } from '../../api';
import { formatKrw, type Dashboard } from '../../domain';
import './home.css';

const formatDate = (date: string) => new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(`${date}T00:00:00`));

export function HomePage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api.dashboard().then(setData).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : '홈을 불러오지 못했어요.')); }, []);
  if (error) return <p>{error}</p>;
  if (!data) return <p>불러오는 중…</p>;
  const days = Math.ceil((new Date(`${data.trip.start_date}T00:00:00`).getTime() - Date.now()) / 86400000);
  const progress = data.checklist.total ? data.checklist.completed / data.checklist.total * 100 : 0;
  return <div className="collabHome">
    <section className="tripHero"><small>OUR NEXT ADVENTURE</small><h1>{data.trip.destination}</h1><p>{data.trip.start_date.replaceAll('-', '.')} — {data.trip.end_date.replaceAll('-', '.')} · {days >= 0 ? `D-${days}` : '여행 중'}</p><footer><div className="avatars">{data.members.map((member) => <i style={{ background: member.avatar_color }} key={member.id}>{member.name[0]}</i>)}</div><span>{data.members.map((member) => member.name).join(' · ')}</span></footer></section>
    <div className="homeGrid"><section className="flowPanel"><header><CalendarDays /><div><h2>여행의 전체 흐름</h2><p>다가오는 일정을 한눈에 확인하세요.</p></div></header>{data.schedulePreview.map((item) => <article key={item.id}><time>{formatDate(item.day_date)}<b>{item.start_time ?? '시간 미정'}</b></time><i /><div><b>{item.title}</b><small>{item.place_name ?? item.category}</small></div></article>)}{!data.schedulePreview.length && <p className="emptyCopy">아직 일정이 없어요.</p>}</section>
    <aside className="homeSide"><section><header><CheckCircle2 /><b>여행 준비</b><strong>{Math.round(progress)}%</strong></header><span className="homeProgress"><i style={{ width: `${progress}%` }} /></span><small>{data.checklist.completed}개 완료 · {data.checklist.total - data.checklist.completed}개 남음</small></section><section className="quickFacts"><p><Inbox /><span>일정 후보</span><b>{data.planningCount}개</b></p><p><WalletCards /><span>여행 비용</span><b>{formatKrw(data.expenseTotal)}</b></p><a href={`/trips/${data.trip.id}/expenses`}>비용 보기 →</a></section></aside></div>
    <section className="activityPanel"><header><Clock3 /><div><h2>함께 만든 기록</h2><p>최근 변경 사항</p></div></header>{data.activities.map((activity) => <article key={activity.id}><i style={{ background: activity.actor_color }}>{activity.actor_name[0]}</i><p><span><b>{activity.actor_name}</b>님이 {activity.summary}</span><small>{activity.created_at.replace('T', ' ').slice(0, 16)}</small></p></article>)}{!data.activities.length && <p className="emptyCopy">아직 함께 만든 기록이 없어요.</p>}</section>
  </div>;
}
