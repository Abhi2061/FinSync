import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { GroupProvider } from './contexts/GroupContext';
import 'bootstrap/dist/css/bootstrap.min.css';
import { registerSW } from 'virtual:pwa-register';

registerSW();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GroupProvider>
      {console.log("🚀 FinSync v5.3")}
      <App />
    </GroupProvider>
  </StrictMode>,
)
