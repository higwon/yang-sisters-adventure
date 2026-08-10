import { Hono } from 'hono';
import { tripContext } from './middleware/trip-context';
import { checklistRoutes } from './routes/checklist';
import { dashboardRoutes } from './routes/dashboard';
import { expenseRoutes } from './routes/expenses';
import { placeRoutes } from './routes/places';
import { reservationRoutes } from './routes/reservations';
import { scheduleRoutes } from './routes/schedule';
import type { AppEnv } from './types';

const app = new Hono<AppEnv>();

app.onError((error, c) => {
  console.error(error);
  return c.json({ error: error.message || '요청을 처리하지 못했습니다.' }, 500);
});

const tripRoutes = new Hono<AppEnv>();
tripRoutes.use('*', tripContext);
tripRoutes.route('/', dashboardRoutes);
tripRoutes.route('/', scheduleRoutes);
tripRoutes.route('/', placeRoutes);
tripRoutes.route('/', checklistRoutes);
tripRoutes.route('/', expenseRoutes);
tripRoutes.route('/', reservationRoutes);
app.route('/api/trips/:tripId', tripRoutes);

export default app;
