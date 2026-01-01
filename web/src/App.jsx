import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import AddTransaction from './components/AddTransaction';
import TransactionList from './components/TransactionList';
import Dashboard from './components/Dashboard';
import GroupManager from './components/GroupManager';
import CurrentGroupBanner from './components/CurrentGroupBanner';
import 'react-toastify/dist/ReactToastify.css';
import { ToastContainer } from 'react-toastify';

function App() {
  const [activeView, setActiveView] = useState('add'); 

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeView]);

  return (
    <div className="min-vh-100 d-flex flex-column">
      <ToastContainer position="top-right" autoClose={3000} />

      <Navbar activeView={activeView} setActiveView={setActiveView} />

      <main className="flex-grow-1" style={{ paddingBottom: '3rem' }}>
        <div className="container" style={{ maxWidth: '800px' }}>
          {/* Global Current Group Banner - Visible on all screens except GroupManager (which has its own header) */}
          {activeView !== 'groups' && <CurrentGroupBanner />}

          <div className="row justify-content-center">
            <div className="col-12">
              {activeView === 'groups' && <GroupManager />}
              {activeView === 'add' && <AddTransaction />}
              {activeView === 'dashboard' && <Dashboard />}
              {activeView === 'history' && <TransactionList />}
            </div>
          </div>
        </div>
      </main>

      <footer className="py-4 text-center text-secondary small">
        <p className="mb-0">FinSync &copy; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}

export default App;
