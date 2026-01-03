
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { t } from './i18n';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error(t('redmine_create_tasks.app.root_missing', 'Root element was not found.'));
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
