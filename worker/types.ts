export type Bindings = { DB: D1Database };

export type Variables = {
  tripId: number;
  userId: number;
  user: { id: number; name: string; email: string; avatar_color: string };
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};
