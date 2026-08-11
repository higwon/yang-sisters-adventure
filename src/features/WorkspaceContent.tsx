import type { ReactNode } from 'react';
import type { WorkspacePage } from '../app/navigation';
import { BoardPage } from './board/BoardPage';
import { ExpensesPage } from './expenses/ExpensesPage';
import { HomePage } from './home/HomePage';
import { ChecklistPage } from './preparation/ChecklistPage';
import { ReservationsPage } from './preparation/ReservationsPage';
import { SchedulePage } from './schedule/SchedulePage';

function ComingSoon({ title, issue }: { title: string; issue: number }) {
  return <section className="comingSoon"><small>COLLABORATION SPACE</small><h2>{title}</h2><p>기본 탐색 구조를 먼저 준비했어요. 기능은 Issue #{issue}에서 연결합니다.</p></section>;
}

export function WorkspaceContent({ page }: { page: WorkspacePage }) {
  const views: Record<WorkspacePage, ReactNode> = {
    home: <HomePage />, schedule: <SchedulePage />, board: <BoardPage />,
    checklist: <ChecklistPage />, expenses: <ExpensesPage />, info: <ReservationsPage />,
    more: <ComingSoon title="여행 도구" issue={3} />,
  };
  return <>{views[page]}</>;
}
