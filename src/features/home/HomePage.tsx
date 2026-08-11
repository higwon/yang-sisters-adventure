import { useEffect, useState } from 'react';
import { CalendarDays, Inbox, WalletCards } from 'lucide-react';
import { api } from '../../api';
import { UserAvatar } from '../../components/UserAvatar';
import { formatKrw, type Dashboard } from '../../domain';
import './home.css';

const formatDate = (date: string) => new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(`${date}T00:00:00`));
export function HomePage() {
  const [data, setData] = useState<Dashboard | null>(null); const [error, setError] = useState('');
  useEffect(() => { api.dashboard().then(setData).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : '홈을 불러오지 못했어요.')); }, []);
  if (error) return <p>{error}</p>; if (!data) return <p>불러오는 중…</p>;
  const days = Math.ceil((new Date(`${data.trip.start_date}T00:00:00`).getTime() - Date.now()) / 86400000);
  return <div className="collabHome"><section className="tripHero"><small>OUR NEXT ADVENTURE</small><h1>{data.trip.destination}</h1><p>{data.trip.start_date.replaceAll('-', '.')} — {data.trip.end_date.replaceAll('-', '.')} · {days >= 0 ? `D-${days}` : '여행 중'}</p><footer><div className="avatars">{data.members.map((member) => <UserAvatar user={member} key={member.id} />)}</div><span>{data.members.map((member) => member.name).join(' · ')}</span></footer></section>
    <section className="homeOverview"><header><CalendarDays /><div><h2>다가오는 일정</h2><p>가까운 여행 일정을 확인하세요.</p></div><a href={`/trips/${data.trip.id}/schedule`}>전체 일정 보기 →</a></header><div className="overviewBody"><div className="schedulePreview">{data.schedulePreview.map((item) => <article key={item.id}><time>{formatDate(item.day_date)}<b>{item.start_time ?? '시간 미정'}</b></time><i /><div><b>{item.title}</b><small>{item.place_name ?? item.category}</small></div></article>)}{!data.schedulePreview.length && <p className="emptyCopy">아직 일정이 없어요.</p>}</div><aside className="homeFacts"><a href={`/trips/${data.trip.id}/schedule`}><Inbox /><span><small>일정 후보</small><b>{data.planningCount}개</b></span><em>보기 →</em></a><a href={`/trips/${data.trip.id}/expenses`}><WalletCards /><span><small>여행 비용</small><b>{formatKrw(data.expenseTotal)}</b></span><em>보기 →</em></a></aside></div></section>
  </div>;
}
