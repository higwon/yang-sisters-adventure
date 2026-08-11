export interface BoardAttachment { id: number; file_name: string; content_type: string; byte_size: number }
export interface BoardConversion { target_type: 'planning' | 'place' | 'reservation'; target_id: number }
export interface BoardPost {
  id: number; trip_id: number; author_id: number; author_name: string; avatar_color: string; avatar_key: string | null;
  kind: 'general' | 'place' | 'restaurant' | 'cafe' | 'tour' | 'info'; title: string | null;
  content: string | null; url: string | null; map_url: string | null; created_at: string;
  attachments: BoardAttachment[]; conversions: BoardConversion[];
}

const base = () => {
  const tripId = window.location.pathname.match(/^\/trips\/(\d+)/)?.[1];
  if (!tripId) throw new Error('여행을 먼저 선택해 주세요.');
  return `/api/trips/${tripId}`;
};

async function response<T>(result: Response): Promise<T> {
  if (!result.ok) {
    const body = await result.json().catch(() => ({ error: '요청에 실패했어요.' })) as { error?: string };
    throw new Error(body.error ?? '요청에 실패했어요.');
  }
  return result.json() as Promise<T>;
}

export const boardApi = {
  posts: async (page = 1) => {
    const result = await response<{ posts: Array<BoardPost & { attachments: string | BoardAttachment[]; conversions: string | BoardConversion[] }>; page: number; has_more: boolean; usage_bytes: number }>(await fetch(`${base()}/posts?page=${page}&limit=10`));
    return { ...result, posts: result.posts.map((post) => ({ ...post,
      attachments: typeof post.attachments === 'string' ? JSON.parse(post.attachments) as BoardAttachment[] : post.attachments,
      conversions: typeof post.conversions === 'string' ? JSON.parse(post.conversions) as BoardConversion[] : post.conversions,
    })) };
  },
  createPost: async (data: { kind: string; title: string; content: string; url: string; files: File[] }) => {
    const form = new FormData();
    form.set('kind', data.kind);
    if (data.title.trim()) form.set('title', data.title.trim());
    if (data.content.trim()) form.set('content', data.content.trim());
    if (data.url.trim()) form.set('url', data.url.trim());
    data.files.forEach((file) => form.append('files', file));
    return response<{ id: number }>(await fetch(`${base()}/posts`, { method: 'POST', body: form }));
  },
  deletePost: async (id: number) => response<{ ok: boolean }>(await fetch(`${base()}/posts/${id}`, { method: 'DELETE' })),
  convertPost: async (id: number, target_type: BoardConversion['target_type']) => response<{ target_id: number }>(await fetch(`${base()}/posts/${id}/convert`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ target_type }) })),
  attachmentUrl: (id: number) => `${base()}/attachments/${id}`,
};
