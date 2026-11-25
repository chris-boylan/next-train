import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter-tight';
import { App } from './App';
import { LangProvider } from './i18n';
import './styles.css';
import { applyTheme } from './theme';

applyTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LangProvider>
      <App />
    </LangProvider>
  </StrictMode>,
);
