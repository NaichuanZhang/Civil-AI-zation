import { createRoot } from 'react-dom/client';
import { App } from './App';
import { LogProvider } from './contexts/LogContext';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <LogProvider>
      <App />
    </LogProvider>
  );
}
