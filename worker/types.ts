export type Bindings = {
  DB: D1Database;
  ATTACHMENTS: R2Bucket;
};

export type Variables = {
  tripId: number;
  userId: number;
  user: { id: number; name: string; email: string; avatar_color: string; avatar_key: string | null };
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};
