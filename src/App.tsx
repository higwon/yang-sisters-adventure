import { navigateToTrip, navigateToTrips, useWorkspacePage, type WorkspacePage } from './app/navigation';
import { useTrip } from './app/TripContext';
import { WorkspaceShell } from './components/WorkspaceShell';
import { WorkspaceContent } from './features/WorkspaceContent';
import { boardApi } from './features/board/boardApi';

export default function App() {
  const trip = useTrip();
  const page = useWorkspacePage();
  const navigate = (nextPage: WorkspacePage) => navigateToTrip(trip.id, nextPage);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void api.prefetchWorkspace();
      void boardApi.prefetch();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [trip.id]);
  return <WorkspaceShell trip={trip} page={page} navigate={navigate} switchTrip={() => navigateToTrips()}>
    <WorkspaceContent page={page} />
  </WorkspaceShell>;
}
import { useEffect } from 'react';
import { api } from './api';
