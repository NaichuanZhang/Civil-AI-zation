import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { LandingPage } from './landing';
import { App } from './App';
import { LogProvider } from './contexts/LogContext';
import './index.css';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <div
      style={{
        flex: 1,
        minHeight: 0,
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <LogProvider>
                  <App />
                </LogProvider>
              </div>
            }
          />
          <Route
            path="/landing"
            element={
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <LandingPage />
              </div>
            }
          />
        </Routes>
      </BrowserRouter>
    </div>
  );
}
