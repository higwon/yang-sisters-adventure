import { useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, Camera, ChevronDown, Plus, Trash2, X } from 'lucide-react';
import { api, type SelectableProfile, type TripMember } from '../../api';
import { useTrip } from '../../app/TripContext';
import { useAuth } from '../../AuthGate';
import { UserAvatar } from '../../components/UserAvatar';
import './settings.css';
import './settings-danger.css';

export function SettingsPage() {
  const trip = useTrip(); const { user, refreshUser, switchProfile } = useAuth();
  const desktop = () => !window.matchMedia('(max-width: 700px)').matches;
  const [tripOpen, setTripOpen] = useState(desktop); const [membersOpen, setMembersOpen] = useState(desktop);
  const [members, setMembers] = useState<TripMember[]>([]); const [profiles, setProfiles] = useState<SelectableProfile[]>([]); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const [saving, setSaving] = useState<'profile' | 'trip' | 'avatar' | undefined>();
  const [confirmingDelete, setConfirmingDelete] = useState(false); const [deleteName, setDeleteName] = useState(''); const [deleting, setDeleting] = useState(false);
  const loadMembers = () => Promise.all([api.tripMembers(trip.id), api.profiles()]).then(([a, b]) => { setMembers(a.members); setProfiles(b.profiles); });
  useEffect(() => { void loadMembers(); }, [trip.id]);
  const owner = trip.role === 'owner';
  useEffect(() => {
    const media = window.matchMedia('(max-width: 700px)');
    const syncDisclosure = (event: MediaQueryListEvent) => {
      setTripOpen(!event.matches);
      setMembersOpen(!event.matches);
    };
    media.addEventListener('change', syncDisclosure);
    return () => media.removeEventListener('change', syncDisclosure);
  }, []);
  const updateProfile = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setError(''); setMessage(''); setSaving('profile'); try { const values = new FormData(event.currentTarget); await api.updateMe(String(values.get('name'))); await refreshUser(); setMessage('프로필을 저장했어요.'); } catch (reason) { setError(reason instanceof Error ? reason.message : '저장하지 못했어요.'); } finally { setSaving(undefined); } };
  const updateTrip = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setError(''); setMessage(''); setSaving('trip'); try { const values = Object.fromEntries(new FormData(event.currentTarget)); const changes = { name: String(values.name), destination: String(values.destination), country_code: String(values.country_code).toUpperCase(), timezone: String(values.timezone) }; await api.updateTrip(trip.id, changes); trip.updateCurrentTrip(changes); setMessage('여행 설정을 저장했어요.'); } catch (reason) { setError(reason instanceof Error ? reason.message : '저장하지 못했어요.'); } finally { setSaving(undefined); } };
  return <section className="settingsPage"><header><h1>설정</h1><p>프로필과 이 여행에 필요한 정보만 관리해요.</p></header>{message && <p className="settingsMessage">{message}</p>}{error && <p className="errorText">{error}</p>}
    <section><h2>내 프로필</h2><div className="profileSettings"><UserAvatar user={user} className="largeAvatar" /><div><label className="imageButton"><Camera />사진 변경<input type="file" accept="image/jpeg,image/png,image/webp" onChange={async (event) => { const file = event.target.files?.[0]; if (file) { try { setSaving('avatar'); setError(''); await api.uploadAvatar(file); await refreshUser(); setMessage('프로필 사진을 저장했어요.'); } catch (reason) { setError(reason instanceof Error ? reason.message : '사진을 저장하지 못했어요.'); } finally { setSaving(undefined); } } }} /></label>{user.avatar_key && <button className="quietDanger" disabled={saving === 'avatar'} onClick={async () => { try { setSaving('avatar'); setError(''); await api.removeAvatar(); await refreshUser(); setMessage('프로필 사진을 삭제했어요.'); } catch (reason) { setError(reason instanceof Error ? reason.message : '사진을 삭제하지 못했어요.'); } finally { setSaving(undefined); } }}>사진 삭제</button>}<small>{saving === 'avatar' ? '사진 처리 중…' : 'JPEG, PNG, WEBP · 최대 2MB'}</small></div></div><form onSubmit={updateProfile}><label>이름<input name="name" defaultValue={user.name} maxLength={30} required /></label><button className="primary" disabled={saving === 'profile'}>{saving === 'profile' ? '저장 중…' : '내 프로필 저장'}</button></form></section>
    <section className="settingsDisclosure"><button className="settingsSectionToggle" onClick={() => setTripOpen(!tripOpen)} aria-expanded={tripOpen}><span><b>여행 설정</b><small>{trip.name} · {trip.destination}</small></span><ChevronDown /></button>{tripOpen && <form onSubmit={updateTrip}><label>여행 이름<input name="name" defaultValue={trip.name} required disabled={!owner} /></label><label>목적지<input name="destination" defaultValue={trip.destination} required disabled={!owner} /></label><input type="hidden" name="country_code" value={trip.country_code} /><input type="hidden" name="timezone" value={trip.timezone} /><p className="settingDates">여행 날짜 · {trip.start_date.replaceAll('-', '.')} — {trip.end_date.replaceAll('-', '.')}</p>{owner && <button className="primary" disabled={saving === 'trip'}>{saving === 'trip' ? '저장 중…' : '여행 설정 저장'}</button>}</form>}</section>
    <section className="settingsDisclosure"><button className="settingsSectionToggle" onClick={() => setMembersOpen(!membersOpen)} aria-expanded={membersOpen}><span><b>멤버 관리</b><small>{members.length}명 참여 중</small></span><ChevronDown /></button>{membersOpen && <div className="settingsMembers">{profiles.map((profile) => { const member = members.find((row) => row.id === profile.id); return <article key={profile.id}><UserAvatar user={profile} /><span><b>{profile.name}</b><small>{member ? member.role === 'owner' ? 'Owner' : '참여 중' : '참여 가능'}</small></span>{owner && member?.role === 'member' && <button onClick={async () => { await api.removeTripMember(trip.id, profile.id); await loadMembers(); }}><Trash2 />제거</button>}{owner && !member && <button onClick={async () => { await api.addTripMember(trip.id, profile.id); await loadMembers(); }}><Plus />추가</button>}</article>; })}</div>}</section>
    {owner && <section className="dangerZone"><h2>여행 삭제</h2><p>이 여행의 일정, 보드, 비용 등 모든 데이터가 함께 삭제됩니다.</p><button className="deleteTripButton" onClick={() => setConfirmingDelete(true)}><Trash2 />여행 삭제</button></section>}
    <section><h2>계정</h2><p>다른 사람의 프로필로 전환합니다.</p><button className="switchProfileButton" onClick={switchProfile}>프로필 변경</button></section>
    {confirmingDelete && <div className="backdrop" onMouseDown={() => setConfirmingDelete(false)}><section className="modal deleteTripDialog" onMouseDown={(event) => event.stopPropagation()}><header><div><AlertTriangle /><h2>여행을 삭제할까요?</h2></div><button onClick={() => setConfirmingDelete(false)} aria-label="닫기"><X /></button></header><p><b>{trip.name}</b>의 모든 데이터가 삭제되며 되돌릴 수 없습니다.</p><label>확인을 위해 여행 이름을 입력하세요.<input value={deleteName} onChange={(event) => setDeleteName(event.target.value)} placeholder={trip.name} autoFocus /></label><footer><button onClick={() => setConfirmingDelete(false)}>취소</button><button className="confirmDelete" disabled={deleting || deleteName !== trip.name} onClick={async () => { try { setDeleting(true); setError(''); await api.deleteTrip(trip.id); trip.removeCurrentTrip(); } catch (reason) { setError(reason instanceof Error ? reason.message : '여행을 삭제하지 못했어요.'); setDeleting(false); setConfirmingDelete(false); } }}>{deleting ? '삭제 중…' : '영구 삭제'}</button></footer></section></div>}
  </section>;
}
