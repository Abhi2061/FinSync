import React, { useState, useEffect } from 'react';
import AddTransaction from './components/AddTransaction';
import TransactionList from './components/TransactionList';
import Dashboard from './components/Dashboard';

function App() {
  const [activeView, setActiveView] = useState('add'); // 'add' | 'dashboard' | 'history'

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeView]);

  return (
    <div className="container py-3">
      <h1 className="text-center mb-4">FinSync</h1>
      <div className="d-flex justify-content-around gap-2 mb-3">
        <button
          className={`btn btn-sm w-100 ${activeView === 'add' ? 'btn-primary' : 'btn-outline-primary'}`}
          onClick={() => setActiveView('add')}
        >
          ➕ Add Transaction
        </button>
        <button
          className={`btn btn-sm w-100 ${activeView === 'dashboard' ? 'btn-primary' : 'btn-outline-primary'}`}
          onClick={() => setActiveView('dashboard')}
        >
          📊 Dashboard
        </button>
        <button
          className={`btn btn-sm w-100 ${activeView === 'history' ? 'btn-primary' : 'btn-outline-primary'}`}
          onClick={() => setActiveView('history')}
        >
          📁 History
        </button>
      </div>

      {activeView === 'add' && <AddTransaction />}
      {activeView === 'dashboard' && <Dashboard />}
      {activeView === 'history' && <TransactionList />}
    </div>

  );
}

export default App;
