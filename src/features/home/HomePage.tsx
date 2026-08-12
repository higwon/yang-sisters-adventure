import { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, Inbox, WalletCards } from 'lucide-react';
import { api } from '../../api';
import { UserAvatar } from '../../components/UserAvatar';
import { formatKrw, type Dashboard } from '../../domain';
import { formatLocalActivityTime } from '../../utils/dateTime';
import './home.css';

const formatDate = (date: string) => new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(`${date}T00:00:00`));

export function HomePage() {
  const [data, setData] = useState<Dashboard | null>(null); const [error, setError] = useState('');
  useEffect(() => { api.dashboard().then(setData).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : '홈을 불러오지 못했어요.')); }, []);
  if (error) return <p className="homeState">{error}</p>; if (!data) return <p className="homeState">홈을 불러오는 중…</p>;
  const days = Math.ceil((new Date(`${data.trip.start_date}T00:00:00`).getTime() - Date.now()) / 86400000);
  return <main className="collabHome">
    <header className="tripSummary"><div><h1>{data.trip.destination}</h1><p>{data.trip.start_date.replaceAll('-', '.')} — {data.trip.end_date.replaceAll('-', '.')}<b>{days >= 0 ? `D-${days}` : '여행 중'}</b></p></div><div className="tripPeople"><div>{data.members.map((member) => <UserAvatar user={member} key={member.id} />)}</div><span>{data.members.map((member) => member.name).join(' · ')}</span></div></header>
    <section className="homeFlow"><div className="upcoming"><header><div><CalendarDays /><span><h2>다가오는 일정</h2><p>가장 가까운 여행 계획이에요.</p></span></div><a href={`/trips/${data.trip.id}/schedule`}>전체 일정 <ArrowRight /></a></header><div className="schedulePreview">{data.schedulePreview.slice(0, 4).map((item) => <a href={`/trips/${data.trip.id}/schedule`} key={item.id}><time>{formatDate(item.day_date)}<b>{item.start_time ?? '시간 미정'}</b></time><i /><span><b>{item.title}</b><small>{item.place_name ?? item.category}</small></span></a>)}{!data.schedulePreview.length && <a className="emptySchedule" href={`/trips/${data.trip.id}/schedule`}>아직 일정이 없어요. 첫 일정을 추가해 보세요 <ArrowRight /></a>}</div></div>
      <aside className="homeSummary"><a href={`/trips/${data.trip.id}/schedule`}><Inbox /><span><small>일정 후보</small><b>{data.planningCount}개</b></span><ArrowRight /></a><a href={`/trips/${data.trip.id}/expenses`}><WalletCards /><span><small>여행 비용</small><b>{formatKrw(data.expenseTotal)}</b></span><ArrowRight /></a></aside></section>
    {data.activities.length > 0 && <section className="recentActivity"><header><h2>최근 함께 만든 기록</h2><p>여행에서 달라진 내용을 가볍게 확인하세요.</p></header><div>{data.activities.slice(0, 3).map((activity) => <article key={activity.id}><UserAvatar user={{ id: activity.actor_id, name: activity.actor_name, avatar_color: activity.actor_color, avatar_key: activity.actor_avatar_key }} /><span><b>{activity.summary}</b><small>{formatLocalActivityTime(activity.created_at)}</small></span></article>)}</div></section>}
  </main>;
}
