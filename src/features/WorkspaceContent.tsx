import type { ReactNode } from 'react';
import type { WorkspacePage } from '../app/navigation';
import { BoardPage } from './board/BoardPage';
import { ExpensesPage } from './expenses/ExpensesPage';
import { HomePage } from './home/HomePage';
import { SchedulePage } from './schedule/SchedulePage';
import { SettingsPage } from './settings/SettingsPage';

export function WorkspaceContent({ page }: { page: WorkspacePage }) {
  const views: Record<WorkspacePage, ReactNode> = { home: <HomePage />, schedule: <SchedulePage />, board: <BoardPage />, expenses: <ExpensesPage />, settings: <SettingsPage /> };
  return <>{views[page]}</>;
}
