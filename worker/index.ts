import { Hono } from 'hono';
import { activityMiddleware } from './services/activity';
import { requireAuth } from './middleware/auth';
import { tripContext } from './middleware/trip-context';
import { authRoutes } from './routes/auth';
import { boardRoutes } from './routes/board';
import { checklistRoutes } from './routes/checklist';
import { dashboardRoutes } from './routes/dashboard';
import { expenseRoutes } from './routes/expenses';
import { placeRoutes } from './routes/places';
import { planningRoutes } from './routes/planning';
import { reservationRoutes } from './routes/reservations';
import { scheduleRoutes } from './routes/schedule';
import { tripsRoutes } from './routes/trips';
import type { AppEnv } from './types';

const app = new Hono<AppEnv>();

app.onError((error, c) => {
  console.error(error);
  return c.json({ error: '요청을 처리하지 못했습니다.' }, 500);
});

app.route('/api/auth', authRoutes);
app.route('/api/trips', tripsRoutes);

const tripRoutes = new Hono<AppEnv>();
tripRoutes.use('*', requireAuth);
tripRoutes.use('*', tripContext);
tripRoutes.use('*', activityMiddleware);
tripRoutes.route('/', dashboardRoutes);
tripRoutes.route('/', boardRoutes);
tripRoutes.route('/', scheduleRoutes);
tripRoutes.route('/', placeRoutes);
tripRoutes.route('/', planningRoutes);
tripRoutes.route('/', checklistRoutes);
tripRoutes.route('/', expenseRoutes);
tripRoutes.route('/', reservationRoutes);
app.route('/api/trips/:tripId', tripRoutes);

export default app;
