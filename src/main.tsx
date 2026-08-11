import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthGate } from './AuthGate';
import { WorkspaceGate } from './WorkspaceGate';
import './styles.css';
import './polish.css';

createRoot(document.getElementById('root')!).render(<StrictMode><AuthGate><WorkspaceGate><App /></WorkspaceGate></AuthGate></StrictMode>);
