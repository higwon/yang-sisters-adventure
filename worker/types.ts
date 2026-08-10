export type Bindings = { DB: D1Database };

export type Variables = {
  tripId: number;
  userId: number;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};
