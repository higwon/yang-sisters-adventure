import { useEffect, useState, type FormEvent } from 'react';
import { Camera, Plus, Trash2 } from 'lucide-react';
import { api, type SelectableProfile, type TripMember } from '../../api';
import { useTrip } from '../../app/TripContext';
import { useAuth } from '../../AuthGate';
import { UserAvatar } from '../../components/UserAvatar';
import './settings.css';

export function SettingsPage() {
  const trip = useTrip(); const { user, refreshUser, switchProfile } = useAuth();
  const [members, setMembers] = useState<TripMember[]>([]); const [profiles, setProfiles] = useState<SelectableProfile[]>([]); const [message, setMessage] = useState('');
  const loadMembers = () => Promise.all([api.tripMembers(trip.id), api.profiles()]).then(([a, b]) => { setMembers(a.members); setProfiles(b.profiles); });
  useEffect(() => { void loadMembers(); }, [trip.id]);
  const owner = trip.role === 'owner';
  const updateProfile = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const values = new FormData(event.currentTarget); await api.updateMe(String(values.get('name'))); await refreshUser(); setMessage('프로필을 저장했어요.'); };
  const updateTrip = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); const changes = { name: String(values.name), destination: String(values.destination), country_code: String(values.country_code).toUpperCase(), timezone: String(values.timezone) }; await api.updateTrip(trip.id, changes); trip.updateCurrentTrip(changes); setMessage('여행 설정을 저장했어요.'); };
  return <section className="settingsPage"><header><small>SETTINGS</small><h1>설정</h1><p>프로필과 이 여행에 필요한 정보만 관리해요.</p></header>{message && <p className="settingsMessage">{message}</p>}
    <section><h2>내 프로필</h2><div className="profileSettings"><UserAvatar user={user} className="largeAvatar" /><div><label className="imageButton"><Camera />사진 변경<input type="file" accept="image/jpeg,image/png,image/webp" onChange={async (event) => { const file = event.target.files?.[0]; if (file) { await api.uploadAvatar(file); await refreshUser(); } }} /></label>{user.avatar_key && <button className="quietDanger" onClick={async () => { await api.removeAvatar(); await refreshUser(); }}>사진 삭제</button>}<small>JPEG, PNG, WEBP · 최대 2MB</small></div></div><form onSubmit={updateProfile}><label>이름<input name="name" defaultValue={user.name} maxLength={30} required /></label><button className="primary">내 프로필 저장</button></form></section>
    <section><h2>여행 설정</h2><form onSubmit={updateTrip}><label>여행 이름<input name="name" defaultValue={trip.name} required disabled={!owner} /></label><label>목적지<input name="destination" defaultValue={trip.destination} required disabled={!owner} /></label><div className="formRow"><label>국가 코드<input name="country_code" defaultValue={trip.country_code} maxLength={2} required disabled={!owner} /></label><label>시간대<input name="timezone" defaultValue={trip.timezone} required disabled={!owner} /></label></div><p className="settingDates">여행 날짜 · {trip.start_date} — {trip.end_date}</p>{owner && <button className="primary">여행 설정 저장</button>}</form></section>
    <section><h2>멤버 관리</h2><div className="settingsMembers">{profiles.map((profile) => { const member = members.find((row) => row.id === profile.id); return <article key={profile.id}><UserAvatar user={profile} /><span><b>{profile.name}</b><small>{member ? member.role === 'owner' ? 'Owner' : '참여 중' : '참여 가능'}</small></span>{owner && member?.role === 'member' && <button onClick={async () => { await api.removeTripMember(trip.id, profile.id); await loadMembers(); }}><Trash2 />제거</button>}{owner && !member && <button onClick={async () => { await api.addTripMember(trip.id, profile.id); await loadMembers(); }}><Plus />추가</button>}</article>; })}</div></section>
    <section><h2>계정</h2><p>다른 사람의 프로필로 전환합니다. 비밀번호나 회원가입은 사용하지 않아요.</p><button className="switchProfileButton" onClick={switchProfile}>프로필 변경</button></section>
  </section>;
}
