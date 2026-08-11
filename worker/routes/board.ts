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

boardRoutes.get('/posts', async (c) => {
  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const limit = Math.min(30, Math.max(1, Number(c.req.query('limit')) || 10));
  const offset = (page - 1) * limit;
  const tripId = c.get('tripId');
  const [posts, count, usage] = await Promise.all([
    c.env.DB.prepare(`SELECT p.*,u.name author_name,u.avatar_color,
      (SELECT json_group_array(json_object('id',a.id,'file_name',a.file_name,'content_type',a.content_type,'byte_size',a.byte_size)) FROM attachments a WHERE a.post_id=p.id) attachments,
      (SELECT json_group_array(json_object('target_type',pc.target_type,'target_id',pc.target_id)) FROM post_conversions pc WHERE pc.post_id=p.id) conversions
      FROM posts p JOIN users u ON u.id=p.author_id WHERE p.trip_id=? ORDER BY p.created_at DESC,p.id DESC LIMIT ? OFFSET ?`)
      .bind(tripId, limit, offset).all(),
    c.env.DB.prepare('SELECT COUNT(*) count FROM posts WHERE trip_id=?').bind(tripId).first<number>('count'),
    c.env.DB.prepare('SELECT COALESCE(SUM(a.byte_size),0) bytes FROM attachments a JOIN posts p ON p.id=a.post_id WHERE p.trip_id=?')
      .bind(tripId).first<number>('bytes'),
  ]);
  return c.json({ posts: posts.results, page, has_more: offset + posts.results.length < (count ?? 0), usage_bytes: usage ?? 0 });
});

boardRoutes.post('/posts', async (c) => {
  const form = await c.req.formData();
  const content = String(form.get('content') ?? '').trim() || null;
  const rawUrl = String(form.get('url') ?? '').trim();
  const url = rawUrl || null;
  if (url && !z.string().url().safeParse(url).success) return c.json({ error: '올바른 URL을 입력해 주세요.' }, 400);
  const files = form.getAll('files').filter((item): item is File => item instanceof File && item.size > 0);
  if (!content && !url && files.length === 0) return c.json({ error: '내용, URL 또는 첨부파일을 입력해 주세요.' }, 400);
  try {
    validateAttachments(files);
    const usedBytes = await c.env.DB.prepare('SELECT COALESCE(SUM(byte_size),0) bytes FROM attachments').first<number>('bytes') ?? 0;
    assertWithinQuota(usedBytes, files.reduce((sum, file) => sum + file.size, 0));
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : '첨부파일을 확인해 주세요.' }, 400);
  }

  const post = await c.env.DB.prepare('INSERT INTO posts(trip_id,author_id,content,url) VALUES(?,?,?,?) RETURNING id')
    .bind(c.get('tripId'), c.get('userId'), content, url).first<{ id: number }>();
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

boardRoutes.delete('/posts/:id', async (c) => {
  const post = await c.env.DB.prepare('SELECT id FROM posts WHERE id=? AND trip_id=?').bind(c.req.param('id'), c.get('tripId')).first();
  if (!post) return c.json({ error: '게시물을 찾을 수 없어요.' }, 404);
  const attachments = await c.env.DB.prepare('SELECT object_key FROM attachments WHERE post_id=?').bind(c.req.param('id')).all<{ object_key: string }>();
  await Promise.all(attachments.results.map(({ object_key }) => c.env.ATTACHMENTS.delete(object_key)));
  await c.env.DB.prepare('DELETE FROM posts WHERE id=? AND trip_id=?').bind(c.req.param('id'), c.get('tripId')).run();
  return c.json({ ok: true });
});

boardRoutes.post('/posts/:id/convert', zValidator('json', conversionSchema), async (c) => {
  const tripId = c.get('tripId');
  const data = c.req.valid('json');
  const post = await c.env.DB.prepare('SELECT * FROM posts WHERE id=? AND trip_id=?').bind(c.req.param('id'), tripId)
    .first<{ id: number; content: string | null; url: string | null }>();
  if (!post) return c.json({ error: '게시물을 찾을 수 없어요.' }, 404);
  const existing = await c.env.DB.prepare('SELECT target_id FROM post_conversions WHERE post_id=? AND target_type=?')
    .bind(post.id, data.target_type).first<number>('target_id');
  if (existing) return c.json({ target_id: existing });
  const title = data.title ?? post.content?.split('\n')[0]?.slice(0, 100) ?? '공유한 여행 정보';
  let targetId: number | null | undefined;
  if (data.target_type === 'planning') {
    targetId = await c.env.DB.prepare(`INSERT INTO planning_items(trip_id,title,item_type,url,notes,created_by) VALUES(?,?,?,?,?,?) RETURNING id`)
      .bind(tripId, title, '기타', post.url, post.content, c.get('userId')).first<number>('id');
  } else if (data.target_type === 'place') {
    targetId = await c.env.DB.prepare(`INSERT INTO places(trip_id,name,category,website_url,notes,is_must_visit) VALUES(?,?,?,?,?,0) RETURNING id`)
      .bind(tripId, title, '기타', post.url, post.content).first<number>('id');
  } else {
    targetId = await c.env.DB.prepare(`INSERT INTO reservations(trip_id,title,type,link,notes) VALUES(?,?,?,?,?) RETURNING id`)
      .bind(tripId, title, '기타', post.url, post.content).first<number>('id');
  }
  if (!targetId) return c.json({ error: '여행 데이터로 전환하지 못했어요.' }, 500);
  await c.env.DB.prepare('INSERT INTO post_conversions(post_id,target_type,target_id) VALUES(?,?,?)')
    .bind(post.id, data.target_type, targetId).run();
  return c.json({ target_id: targetId }, 201);
});
