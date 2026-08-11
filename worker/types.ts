export type Bindings = {
  DB: D1Database;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
};

export type Variables = {
  tripId: number;
  userId: number;
  user: { id: number; name: string; email: string; avatar_color: string };
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};
