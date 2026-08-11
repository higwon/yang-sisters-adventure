import { useEffect, useRef, useState } from 'react';
import { ExternalLink, FileText, Image, MapPinned, Plus, Send, Trash2 } from 'lucide-react';
import { UserAvatar } from '../../components/UserAvatar';
import { boardApi, type BoardPost } from './boardApi';
import './board.css';

const formatBytes = (bytes: number) => bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)}KB` : `${(bytes / 1024 / 1024).toFixed(1)}MB`;

export function BoardPage() {
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [usage, setUsage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [kind, setKind] = useState('general');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [showOptions, setShowOptions] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [busyPost, setBusyPost] = useState<number>();
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async (nextPage = 1, append = false) => {
    try {
      setLoading(true);
      const result = await boardApi.posts(nextPage);
      setPosts((current) => append ? [...current, ...result.posts] : result.posts);
      setPage(nextPage); setHasMore(result.has_more); setUsage(result.usage_bytes); setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : '게시물을 불러오지 못했어요.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const publish = async (event: React.FormEvent) => {
    event.preventDefault();
    if (publishing) return;
    try {
      setPublishing(true); setError('');
      await boardApi.createPost({ kind, title, content, url, files });
      setKind('general'); setTitle(''); setContent(''); setUrl(''); setFiles([]); setShowOptions(false); if (inputRef.current) inputRef.current.value = '';
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : '게시물을 저장하지 못했어요.'); }
    finally { setPublishing(false); }
  };

  const convert = async (post: BoardPost, target: 'planning') => {
    try { setBusyPost(post.id); setError(''); await boardApi.convertPost(post.id, target); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '여행 데이터로 전환하지 못했어요.'); }
    finally { setBusyPost(undefined); }
  };

  return <section className="boardPage">
    <header className="boardHeader"><div><h1>여행 보드</h1><p>가고 싶은 곳, 맛집, 예약 정보와 링크를 함께 모아보세요.</p></div>{usage >= 1.4 * 1024 * 1024 * 1024 && <aside><b>저장공간을 많이 사용하고 있어요</b><span><i style={{ width: `${Math.min(100, usage / (2 * 1024 * 1024 * 1024) * 100)}%` }} /></span><small>{formatBytes(usage)} 사용 중</small></aside>}</header>
    <form className="postComposer" onSubmit={publish}>
      <textarea value={content} onFocus={() => setShowOptions(true)} onChange={(event) => setContent(event.target.value)} placeholder="여행 정보를 공유해보세요…" />
      {showOptions && <><div className="composerMeta"><select value={kind} onChange={(event) => setKind(event.target.value)}><option value="general">일반</option><option value="place">장소</option><option value="restaurant">맛집</option><option value="cafe">카페</option><option value="tour">투어</option><option value="info">예약/정보</option></select><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="제목 (선택)" /></div><input className="composerLink" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="관련 링크 (선택)" /></>}
      <footer><label><Plus size={16} />사진/파일<input ref={inputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => { setFiles(Array.from(event.target.files ?? [])); setShowOptions(true); }} /></label><button type="button" className="composerOptions" onClick={() => setShowOptions(!showOptions)}>옵션</button><span>{files.map((file) => file.name).join(', ')}</span><button className="primary" disabled={publishing}><Send size={16} />{publishing ? '게시 중…' : '게시'}</button></footer>
    </form>
    {error && <p className="boardError">{error}</p>}
    <div className="postFeed">{posts.map((post) => { const link = post.map_url ?? post.url; const mapLink = link ? isMapLink(link) : false; return <article className="postCard" key={post.id}>
      <header><UserAvatar user={{ id: post.author_id, name: post.author_name, avatar_color: post.avatar_color, avatar_key: post.avatar_key }} /><div><b>{post.author_name}</b><small>{post.created_at.replace('T', ' ').slice(0, 16)}</small></div><button aria-label="게시물 삭제" disabled={busyPost === post.id} onClick={async () => { if (confirm('게시물과 첨부파일을 삭제할까요?')) { try { setBusyPost(post.id); setError(''); await boardApi.deletePost(post.id); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : '게시물을 삭제하지 못했어요.'); } finally { setBusyPost(undefined); } } }}><Trash2 size={16} /></button></header>
      <small className={`postKind ${post.kind}`}>{kindLabel(post.kind)}</small>
      {post.title && <h2>{post.title}</h2>}
      {post.content && <p>{post.content}</p>}
      {link && <a className={`sharedUrl ${mapLink ? 'mapLink' : ''}`} href={link} target="_blank" rel="noreferrer">{mapLink ? <MapPinned size={15} /> : <ExternalLink size={15} />}{mapLink ? '지도에서 보기' : '링크 열기'}<small>{link}</small></a>}
      {post.attachments.length > 0 && <div className="attachments">{post.attachments.map((attachment) => attachment.content_type.startsWith('image/') ? <a href={boardApi.attachmentUrl(attachment.id)} target="_blank" rel="noreferrer" key={attachment.id}><img src={boardApi.attachmentUrl(attachment.id)} alt={attachment.file_name} /><small>{attachment.file_name}</small></a> : <a className="pdf" href={boardApi.attachmentUrl(attachment.id)} target="_blank" rel="noreferrer" key={attachment.id}><FileText /><span><b>{attachment.file_name}</b><small>{formatBytes(attachment.byte_size)}</small></span></a>)}</div>}
      <footer><span>여행 계획으로 연결</span><button disabled={busyPost === post.id || post.conversions.some((x) => x.target_type === 'planning')} onClick={() => convert(post, 'planning')}><Plus size={14} />{busyPost === post.id ? '추가 중…' : '일정 후보로 추가'}</button></footer>
    </article>; })}</div>
    {!loading && posts.length === 0 && <div className="boardEmpty"><Image /><b>아직 공유한 자료가 없어요.</b><span>첫 링크나 파일을 올려보세요.</span></div>}
    {hasMore && <button className="loadMore" disabled={loading} onClick={() => load(page + 1, true)}>{loading ? '불러오는 중…' : '이전 게시물 더 보기'}</button>}
  </section>;
}

const kindLabel = (kind: BoardPost['kind']) => ({ general: '일반', place: '장소', restaurant: '맛집', cafe: '카페', tour: '투어', info: '예약/정보' })[kind];
const isMapLink = (value: string) => {
  try {
    const url = new URL(value); const host = url.hostname.toLowerCase();
    return host === 'maps.app.goo.gl' || host === 'maps.google.com' || host.endsWith('.maps.google.com') || host.includes('google.') && url.pathname.startsWith('/maps') || host === 'goo.gl' && url.pathname.startsWith('/maps');
  } catch { return false; }
};
