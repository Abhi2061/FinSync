import AddTransaction from './components/AddTransaction';
import TransactionList from './components/TransactionList';
import Dashboard from './components/Dashboard';

function App() {
  return (
    <div className="container">
      <h1 className="text-center my-4">FinSync</h1>
      <AddTransaction />
      <hr />
      <TransactionList />
      <hr />
      <Dashboard />
    </div>
  );
}

export default App;
