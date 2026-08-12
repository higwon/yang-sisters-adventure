import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { assertWithinQuota, safeFileName, validateAttachments } from '../services/attachments';
import type { AppEnv } from '../types';

export const boardRoutes = new Hono<AppEnv>();

const conversionSchema = z.object({
  target_type: z.enum(['planning', 'place', 'reservation']),
  title: z.string().trim().min(1).optional(),
});

const commentSchema = z.object({ content: z.string().trim().min(1, '댓글을 입력해 주세요.').max(500, '댓글은 500자까지 입력할 수 있어요.') });
const postUpdateSchema = z.object({
  kind: z.enum(['general', 'place', 'restaurant', 'cafe', 'tour', 'info']),
  title: z.string().trim().max(120).nullable(),
  content: z.string().trim().max(5000).nullable(),
  url: z.string().trim().url('올바른 URL을 입력해 주세요.').nullable(),
});

boardRoutes.get('/posts', async (c) => {
  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const limit = Math.min(30, Math.max(1, Number(c.req.query('limit')) || 10));
  const offset = (page - 1) * limit;
  const tripId = c.get('tripId');
  const kind = c.req.query('kind');
  const validKind = kind && ['general', 'place', 'restaurant', 'cafe', 'tour', 'info'].includes(kind) ? kind : null;
  const kindClause = validKind ? ' AND p.kind=?' : '';
  const postBindings = validKind ? [tripId, validKind, limit, offset] : [tripId, limit, offset];
  const countBindings = validKind ? [tripId, validKind] : [tripId];
  const [posts, count, usage] = await Promise.all([
    c.env.DB.prepare(`SELECT p.*,u.name author_name,u.avatar_color,u.avatar_key,
      (SELECT json_group_array(json_object('id',a.id,'file_name',a.file_name,'content_type',a.content_type,'byte_size',a.byte_size)) FROM attachments a WHERE a.post_id=p.id) attachments,
      (SELECT json_group_array(json_object('target_type',pc.target_type,'target_id',pc.target_id)) FROM post_conversions pc WHERE pc.post_id=p.id) conversions
      ,(SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id=p.id) comment_count
      ,(SELECT json_group_array(json_object('id',c.id,'author_id',c.author_id,'author_name',c.author_name,'avatar_color',c.avatar_color,'avatar_key',c.avatar_key,'content',c.content,'created_at',c.created_at)) FROM (
        SELECT latest.* FROM (
          SELECT pc.id,pc.author_id,u.name author_name,u.avatar_color,u.avatar_key,pc.content,pc.created_at
          FROM post_comments pc JOIN users u ON u.id=pc.author_id WHERE pc.post_id=p.id
          ORDER BY pc.created_at DESC,pc.id DESC LIMIT 2
        ) latest ORDER BY latest.created_at,latest.id
      ) c) comments
      FROM posts p JOIN users u ON u.id=p.author_id WHERE p.trip_id=?${kindClause} ORDER BY p.created_at DESC,p.id DESC LIMIT ? OFFSET ?`)
      .bind(...postBindings).all(),
    c.env.DB.prepare(`SELECT COUNT(*) count FROM posts p WHERE p.trip_id=?${kindClause}`).bind(...countBindings).first<number>('count'),
    c.env.DB.prepare('SELECT COALESCE(SUM(a.byte_size),0) bytes FROM attachments a JOIN posts p ON p.id=a.post_id WHERE p.trip_id=?')
      .bind(tripId).first<number>('bytes'),
  ]);
  return c.json({ posts: posts.results, page, has_more: offset + posts.results.length < (count ?? 0), usage_bytes: usage ?? 0, current_user_id: c.get('userId') });
});

boardRoutes.post('/posts/:id/comments', zValidator('json', commentSchema), async (c) => {
  const post = await c.env.DB.prepare('SELECT id FROM posts WHERE id=? AND trip_id=?').bind(c.req.param('id'), c.get('tripId')).first();
  if (!post) return c.json({ error: '게시물을 찾을 수 없어요.' }, 404);
  const comment = await c.env.DB.prepare(`INSERT INTO post_comments(post_id,author_id,content) VALUES(?,?,?)
    RETURNING id,author_id,content,created_at`).bind(c.req.param('id'), c.get('userId'), c.req.valid('json').content)
    .first<{ id: number; author_id: number; content: string; created_at: string }>();
  if (!comment) return c.json({ error: '댓글을 저장하지 못했어요.' }, 500);
  return c.json({ ...comment, author_name: c.get('user').name, avatar_color: c.get('user').avatar_color, avatar_key: c.get('user').avatar_key }, 201);
});

boardRoutes.get('/posts/:id/comments', async (c) => {
  const post = await c.env.DB.prepare('SELECT id FROM posts WHERE id=? AND trip_id=?').bind(c.req.param('id'), c.get('tripId')).first();
  if (!post) return c.json({ error: '게시물을 찾을 수 없어요.' }, 404);
  const comments = await c.env.DB.prepare(`SELECT pc.id,pc.author_id,u.name author_name,u.avatar_color,u.avatar_key,pc.content,pc.created_at
    FROM post_comments pc JOIN users u ON u.id=pc.author_id WHERE pc.post_id=? ORDER BY pc.created_at,pc.id`).bind(c.req.param('id')).all();
  return c.json({ comments: comments.results });
});

boardRoutes.delete('/posts/:postId/comments/:commentId', async (c) => {
  const comment = await c.env.DB.prepare(`SELECT pc.id,pc.author_id FROM post_comments pc JOIN posts p ON p.id=pc.post_id
    WHERE pc.id=? AND pc.post_id=? AND p.trip_id=?`).bind(c.req.param('commentId'), c.req.param('postId'), c.get('tripId')).first<{ id: number; author_id: number }>();
  if (!comment) return c.json({ error: '댓글을 찾을 수 없어요.' }, 404);
  if (comment.author_id !== c.get('userId')) return c.json({ error: '내 댓글만 삭제할 수 있어요.' }, 403);
  await c.env.DB.prepare('DELETE FROM post_comments WHERE id=?').bind(comment.id).run();
  return c.json({ ok: true });
});

boardRoutes.get('/attachments', async (c) => c.json((await c.env.DB.prepare(`SELECT a.id,a.file_name,a.content_type,a.byte_size,p.title post_title FROM attachments a JOIN posts p ON p.id=a.post_id WHERE p.trip_id=? ORDER BY a.created_at DESC LIMIT 100`).bind(c.get('tripId')).all()).results));

boardRoutes.post('/posts', async (c) => {
  const form = await c.req.formData();
  const kind = String(form.get('kind') ?? 'general');
  if (!['general', 'place', 'restaurant', 'cafe', 'tour', 'info'].includes(kind)) return c.json({ error: '게시물 종류를 확인해 주세요.' }, 400);
  const title = String(form.get('title') ?? '').trim() || null;
  const content = String(form.get('content') ?? '').trim() || null;
  const rawUrl = String(form.get('url') ?? '').trim();
  const url = rawUrl || null;
  const rawMapUrl = String(form.get('map_url') ?? '').trim();
  const mapUrl = rawMapUrl || null;
  if (url && !z.string().url().safeParse(url).success) return c.json({ error: '올바른 URL을 입력해 주세요.' }, 400);
  if (mapUrl && !z.string().url().safeParse(mapUrl).success) return c.json({ error: '올바른 지도 URL을 입력해 주세요.' }, 400);
  const files = form.getAll('files').filter((item): item is File => item instanceof File && item.size > 0);
  if (!title && !content && !url && !mapUrl && files.length === 0) return c.json({ error: '제목, 내용, URL 또는 첨부파일을 입력해 주세요.' }, 400);
  try {
    validateAttachments(files);
    const usedBytes = await c.env.DB.prepare('SELECT COALESCE(SUM(byte_size),0) bytes FROM attachments').first<number>('bytes') ?? 0;
    assertWithinQuota(usedBytes, files.reduce((sum, file) => sum + file.size, 0));
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : '첨부파일을 확인해 주세요.' }, 400);
  }

  const post = await c.env.DB.prepare('INSERT INTO posts(trip_id,author_id,kind,title,content,url,map_url) VALUES(?,?,?,?,?,?,?) RETURNING id')
    .bind(c.get('tripId'), c.get('userId'), kind, title, content, url, mapUrl).first<{ id: number }>();
  if (!post) return c.json({ error: '게시물을 저장하지 못했어요.' }, 500);
  const uploaded: string[] = [];
  try {
    for (const file of files) {
      const key = `trips/${c.get('tripId')}/posts/${post.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
      await c.env.ATTACHMENTS.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
      uploaded.push(key);
      await c.env.DB.prepare('INSERT INTO attachments(post_id,object_key,file_name,content_type,byte_size) VALUES(?,?,?,?,?)')
        .bind(post.id, key, file.name, file.type, file.size).run();
    }
    return c.json({ id: post.id }, 201);
  } catch (error) {
    await Promise.all(uploaded.map((key) => c.env.ATTACHMENTS.delete(key)));
    await c.env.DB.prepare('DELETE FROM posts WHERE id=?').bind(post.id).run();
    console.error(error);
    return c.json({ error: '첨부파일을 저장하지 못했어요.' }, 500);
  }
});

boardRoutes.get('/attachments/:id', async (c) => {
  const attachment = await c.env.DB.prepare(`SELECT a.* FROM attachments a JOIN posts p ON p.id=a.post_id
    WHERE a.id=? AND p.trip_id=?`).bind(c.req.param('id'), c.get('tripId')).first<{ object_key: string; file_name: string; content_type: string }>();
  if (!attachment) return c.json({ error: '첨부파일을 찾을 수 없어요.' }, 404);
  const object = await c.env.ATTACHMENTS.get(attachment.object_key);
  if (!object) return c.json({ error: '첨부파일 원본을 찾을 수 없어요.' }, 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('content-type', attachment.content_type);
  headers.set('content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(attachment.file_name)}`);
  headers.set('cache-control', 'private, max-age=3600');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(object.body, { headers });
});

boardRoutes.post('/posts/:id/attachments', async (c) => {
  const post = await c.env.DB.prepare('SELECT id,author_id FROM posts WHERE id=? AND trip_id=?')
    .bind(c.req.param('id'), c.get('tripId')).first<{ id: number; author_id: number }>();
  if (!post) return c.json({ error: '게시물을 찾을 수 없어요.' }, 404);
  if (post.author_id !== c.get('userId')) return c.json({ error: '내 게시물만 수정할 수 있어요.' }, 403);
  const form = await c.req.formData();
  const files = form.getAll('files').filter((item): item is File => item instanceof File && item.size > 0);
  const currentImages = await c.env.DB.prepare("SELECT COUNT(*) count FROM attachments WHERE post_id=? AND content_type LIKE 'image/%'")
    .bind(post.id).first<number>('count') ?? 0;
  try {
    validateAttachments(files);
    const incomingImages = files.filter((file) => file.type.startsWith('image/')).length;
    if (currentImages + incomingImages > 5) throw new Error('이미지는 게시물당 5개까지 첨부할 수 있어요.');
    const usedBytes = await c.env.DB.prepare('SELECT COALESCE(SUM(byte_size),0) bytes FROM attachments').first<number>('bytes') ?? 0;
    assertWithinQuota(usedBytes, files.reduce((sum, file) => sum + file.size, 0));
  } catch (error) { return c.json({ error: error instanceof Error ? error.message : '첨부 파일을 확인해 주세요.' }, 400); }
  const created: Array<{ id: number; file_name: string; content_type: string; byte_size: number }> = [];
  for (const file of files) {
    const key = `trips/${c.get('tripId')}/posts/${post.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    await c.env.ATTACHMENTS.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
    try {
      const attachment = await c.env.DB.prepare('INSERT INTO attachments(post_id,object_key,file_name,content_type,byte_size) VALUES(?,?,?,?,?) RETURNING id,file_name,content_type,byte_size')
        .bind(post.id, key, file.name, file.type, file.size).first<{ id: number; file_name: string; content_type: string; byte_size: number }>();
      if (attachment) created.push(attachment);
    } catch (error) { await c.env.ATTACHMENTS.delete(key); throw error; }
  }
  return c.json({ attachments: created }, 201);
});

boardRoutes.put('/posts/:id', async (c) => {
  const post = await c.env.DB.prepare('SELECT id,author_id FROM posts WHERE id=? AND trip_id=?')
    .bind(c.req.param('id'), c.get('tripId')).first<{ id: number; author_id: number }>();
  if (!post) return c.json({ error: '게시물을 찾을 수 없어요.' }, 404);
  if (post.author_id !== c.get('userId')) return c.json({ error: '내 게시물만 수정할 수 있어요.' }, 403);
  const form = await c.req.formData();
  const kind = String(form.get('kind') ?? 'general');
  if (!['general', 'place', 'restaurant', 'cafe', 'tour', 'info'].includes(kind)) return c.json({ error: '게시물 종류를 확인해 주세요.' }, 400);
  const title = String(form.get('title') ?? '').trim() || null;
  const content = String(form.get('content') ?? '').trim() || null;
  const rawUrl = String(form.get('url') ?? '').trim(); const url = rawUrl || null;
  if (url && !z.string().url().safeParse(url).success) return c.json({ error: '올바른 URL을 입력해 주세요.' }, 400);
  const removeIds = [...new Set(form.getAll('remove_attachment_ids').map(Number).filter(Number.isInteger))];
  const current = await c.env.DB.prepare('SELECT id,object_key,file_name,content_type,byte_size FROM attachments WHERE post_id=?')
    .bind(post.id).all<{ id: number; object_key: string; file_name: string; content_type: string; byte_size: number }>();
  if (removeIds.some((id) => !current.results.some((attachment) => attachment.id === id))) return c.json({ error: '삭제할 첨부 파일을 확인해 주세요.' }, 400);
  const files = form.getAll('files').filter((item): item is File => item instanceof File && item.size > 0);
  const retained = current.results.filter((attachment) => !removeIds.includes(attachment.id));
  try {
    validateAttachments(files);
    const finalImageCount = retained.filter((attachment) => attachment.content_type.startsWith('image/')).length + files.filter((file) => file.type.startsWith('image/')).length;
    if (finalImageCount > 5) throw new Error('이미지는 게시물당 5개까지 첨부할 수 있어요.');
    if (!title && !content && !url && retained.length + files.length === 0) throw new Error('제목, 내용, 링크 또는 첨부 파일 중 하나는 남겨 주세요.');
    const usedBytes = await c.env.DB.prepare('SELECT COALESCE(SUM(byte_size),0) bytes FROM attachments').first<number>('bytes') ?? 0;
    const removedBytes = current.results.filter((attachment) => removeIds.includes(attachment.id)).reduce((sum, attachment) => sum + attachment.byte_size, 0);
    assertWithinQuota(usedBytes - removedBytes, files.reduce((sum, file) => sum + file.size, 0));
  } catch (error) { return c.json({ error: error instanceof Error ? error.message : '첨부 파일을 확인해 주세요.' }, 400); }

  const uploaded: Array<{ key: string; file: File }> = [];
  try {
    for (const file of files) {
      const key = `trips/${c.get('tripId')}/posts/${post.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
      await c.env.ATTACHMENTS.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
      uploaded.push({ key, file });
    }
    const statements = [c.env.DB.prepare('UPDATE posts SET kind=?,title=?,content=?,url=?,map_url=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND trip_id=?').bind(kind, title, content, url, post.id, c.get('tripId'))];
    for (const { key, file } of uploaded) statements.push(c.env.DB.prepare('INSERT INTO attachments(post_id,object_key,file_name,content_type,byte_size) VALUES(?,?,?,?,?)').bind(post.id, key, file.name, file.type, file.size));
    if (removeIds.length) statements.push(c.env.DB.prepare(`DELETE FROM attachments WHERE post_id=? AND id IN (${removeIds.map(() => '?').join(',')})`).bind(post.id, ...removeIds));
    await c.env.DB.batch(statements);
  } catch (error) {
    await Promise.all(uploaded.map(({ key }) => c.env.ATTACHMENTS.delete(key)));
    console.error(error); return c.json({ error: '게시물 변경사항을 저장하지 못했어요.' }, 500);
  }
  const removedObjects = current.results.filter((attachment) => removeIds.includes(attachment.id));
  await Promise.all(removedObjects.map((attachment) => c.env.ATTACHMENTS.delete(attachment.object_key).catch((error) => console.error('attachment cleanup failed', error))));
  const attachments = await c.env.DB.prepare('SELECT id,file_name,content_type,byte_size FROM attachments WHERE post_id=? ORDER BY id').bind(post.id).all();
  return c.json({ id: post.id, kind, title, content, url, attachments: attachments.results });
});

boardRoutes.delete('/posts/:postId/attachments/:attachmentId', async (c) => {
  const attachment = await c.env.DB.prepare(`SELECT a.id,a.object_key,p.author_id FROM attachments a JOIN posts p ON p.id=a.post_id
    WHERE a.id=? AND a.post_id=? AND p.trip_id=?`).bind(c.req.param('attachmentId'), c.req.param('postId'), c.get('tripId'))
    .first<{ id: number; object_key: string; author_id: number }>();
  if (!attachment) return c.json({ error: '첨부 파일을 찾을 수 없어요.' }, 404);
  if (attachment.author_id !== c.get('userId')) return c.json({ error: '내 게시물의 첨부 파일만 삭제할 수 있어요.' }, 403);
  await c.env.ATTACHMENTS.delete(attachment.object_key);
  await c.env.DB.prepare('DELETE FROM attachments WHERE id=?').bind(attachment.id).run();
  return c.json({ ok: true });
});

boardRoutes.patch('/posts/:id', zValidator('json', postUpdateSchema), async (c) => {
  const post = await c.env.DB.prepare('SELECT id,author_id FROM posts WHERE id=? AND trip_id=?')
    .bind(c.req.param('id'), c.get('tripId')).first<{ id: number; author_id: number }>();
  if (!post) return c.json({ error: '게시물을 찾을 수 없어요.' }, 404);
  if (post.author_id !== c.get('userId')) return c.json({ error: '내 게시물만 수정할 수 있어요.' }, 403);
  const data = c.req.valid('json');
  if (!data.title && !data.content && !data.url) {
    const attachmentCount = await c.env.DB.prepare('SELECT COUNT(*) count FROM attachments WHERE post_id=?').bind(post.id).first<number>('count') ?? 0;
    if (!attachmentCount) return c.json({ error: '제목, 내용, 링크 또는 첨부 파일 중 하나는 남겨 주세요.' }, 400);
  }
  await c.env.DB.prepare('UPDATE posts SET kind=?,title=?,content=?,url=?,map_url=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND trip_id=?')
    .bind(data.kind, data.title, data.content, data.url, post.id, c.get('tripId')).run();
  return c.json({ ...data, id: post.id });
});

boardRoutes.delete('/posts/:id', async (c) => {
  const post = await c.env.DB.prepare('SELECT id,author_id FROM posts WHERE id=? AND trip_id=?').bind(c.req.param('id'), c.get('tripId')).first<{ id: number; author_id: number }>();
  if (!post) return c.json({ error: '게시물을 찾을 수 없어요.' }, 404);
  if (post.author_id !== c.get('userId')) return c.json({ error: '내 게시물만 삭제할 수 있어요.' }, 403);
  const attachments = await c.env.DB.prepare('SELECT object_key FROM attachments WHERE post_id=?').bind(c.req.param('id')).all<{ object_key: string }>();
  await Promise.all(attachments.results.map(({ object_key }) => c.env.ATTACHMENTS.delete(object_key)));
  await c.env.DB.prepare('DELETE FROM posts WHERE id=? AND trip_id=?').bind(c.req.param('id'), c.get('tripId')).run();
  return c.json({ ok: true });
});

boardRoutes.post('/posts/:id/convert', zValidator('json', conversionSchema), async (c) => {
  const tripId = c.get('tripId');
  const data = c.req.valid('json');
  const post = await c.env.DB.prepare('SELECT * FROM posts WHERE id=? AND trip_id=?').bind(c.req.param('id'), tripId)
    .first<{ id: number; kind: string; title: string | null; content: string | null; url: string | null; map_url: string | null }>();
  if (!post) return c.json({ error: '게시물을 찾을 수 없어요.' }, 404);
  const existing = await c.env.DB.prepare('SELECT target_id FROM post_conversions WHERE post_id=? AND target_type=?')
    .bind(post.id, data.target_type).first<number>('target_id');
  if (existing) return c.json({ target_id: existing });
  const title = data.title ?? post.title ?? post.content?.split('\n')[0]?.slice(0, 100) ?? '공유한 여행 정보';
  const linkedUrl = post.map_url ?? post.url;
  const planningType = ({ place: '관광', restaurant: '식사', cafe: '카페', tour: '관광', info: '기타', general: '기타' } as Record<string, string>)[post.kind] ?? '기타';
  let targetId: number | null | undefined;
  if (data.target_type === 'planning') {
    targetId = await c.env.DB.prepare(`INSERT INTO planning_items(trip_id,title,item_type,url,notes,created_by) VALUES(?,?,?,?,?,?) RETURNING id`)
      .bind(tripId, title, planningType, linkedUrl, post.content, c.get('userId')).first<number>('id');
  } else if (data.target_type === 'place') {
    targetId = await c.env.DB.prepare(`INSERT INTO places(trip_id,name,category,website_url,notes,is_must_visit) VALUES(?,?,?,?,?,0) RETURNING id`)
      .bind(tripId, title, post.kind, linkedUrl, post.content).first<number>('id');
  } else {
    targetId = await c.env.DB.prepare(`INSERT INTO reservations(trip_id,title,type,link,notes) VALUES(?,?,?,?,?) RETURNING id`)
      .bind(tripId, title, '기타', linkedUrl, post.content).first<number>('id');
  }
  if (!targetId) return c.json({ error: '여행 데이터로 전환하지 못했어요.' }, 500);
  await c.env.DB.prepare('INSERT INTO post_conversions(post_id,target_type,target_id) VALUES(?,?,?)')
    .bind(post.id, data.target_type, targetId).run();
  return c.json({ target_id: targetId }, 201);
});
