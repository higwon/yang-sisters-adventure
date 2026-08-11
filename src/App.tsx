import { navigateToTrip, navigateToTrips, useWorkspacePage, type WorkspacePage } from './app/navigation';
import { useTrip } from './app/TripContext';
import { WorkspaceShell } from './components/WorkspaceShell';
import { WorkspaceContent } from './features/WorkspaceContent';

export default function App() {
  const trip = useTrip();
  const page = useWorkspacePage();
  const navigate = (nextPage: WorkspacePage) => navigateToTrip(trip.id, nextPage);
  return <WorkspaceShell trip={trip} page={page} navigate={navigate} switchTrip={() => navigateToTrips()}>
    <WorkspaceContent page={page} />
  </WorkspaceShell>;
}
