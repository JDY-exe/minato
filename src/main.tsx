import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from './minato-design';
import { App } from './App';
import './minato-design/styles/index.css';
import './site.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><ThemeProvider><App /></ThemeProvider></StrictMode>,
);
