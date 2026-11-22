import { applyTheme } from './lib/theme.js';
applyTheme();
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { StoreProvider } from './lib/store.jsx';
createRoot(document.getElementById('root')).render(<StoreProvider><App /></StoreProvider>);
