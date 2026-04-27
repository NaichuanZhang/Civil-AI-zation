import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { LandingPage } from './landing';
import { App } from './App';
import { LogProvider } from './contexts/LogContext';
import './index.css';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/game"
          element={
            <LogProvider>
              <App />
            </LogProvider>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
