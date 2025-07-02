import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { initDB } from '../utils/db';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#aa46be', '#ff6666'];

const getStartOfDay = (date) => new Date(date.setHours(0, 0, 0, 0));
const getStartOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return getStartOfDay(new Date(d.setDate(diff)));
};
const getStartOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

function Dashboard() {
  const [transactions, setTransactions] = useState([]);
  const [view, setView] = useState('monthly');

  const [income, setIncome] = useState(0);
  const [expense, setExpense] = useState(0);

  const getFilteredTransactions = (rangeStart) => {
    return transactions.filter((txn) => {
      const txnDate = new Date(txn.date);
      return txnDate >= rangeStart && txn.type === 'expense';
    });
  };

  const getPieData = () => {
    const now = new Date();
    let start;

    if (view === 'daily') start = getStartOfDay(now);
    else if (view === 'weekly') start = getStartOfWeek(now);
    else start = getStartOfMonth(now);

    const filtered = getFilteredTransactions(start);

    const categoryMap = {};
    filtered.forEach((txn) => {
      if (!categoryMap[txn.category]) categoryMap[txn.category] = 0;
      categoryMap[txn.category] += txn.amount;
    });

    return Object.entries(categoryMap).map(([name, value]) => ({ name, value }));
  };

  const fetchStats = (txns) => {
    let inc = 0, exp = 0;
    txns.forEach(t => {
      if (t.type === 'income') inc += t.amount;
      else exp += t.amount;
    });
    setIncome(inc);
    setExpense(exp);
  };

  useEffect(() => {
    const fetch = async () => {
      const db = await initDB();
      const txns = await db.getAll('transactions');
      setTransactions(txns);
      fetchStats(txns);
    };
    fetch();
  }, []);

  const pieData = getPieData();
  const balance = income - expense;

  return (
    <div className="container my-4">
      <h2>📊 Dashboard</h2>

      {/* Balance summary */}
      <div className="row text-center my-4">
        <div className="col-md-4">
          <div className="alert alert-success">Income: ₹{income.toFixed(2)}</div>
        </div>
        <div className="col-md-4">
          <div className="alert alert-danger">Expenses: ₹{expense.toFixed(2)}</div>
        </div>
        <div className="col-md-4">
          <div className="alert alert-primary">Balance: ₹{balance.toFixed(2)}</div>
        </div>
      </div>

      {/* View toggles */}
      <div className="mb-3">
        <button
          className={`btn btn-sm me-2 ${view === 'daily' ? 'btn-dark' : 'btn-outline-dark'}`}
          onClick={() => setView('daily')}
        >
          Daily
        </button>
        <button
          className={`btn btn-sm me-2 ${view === 'weekly' ? 'btn-dark' : 'btn-outline-dark'}`}
          onClick={() => setView('weekly')}
        >
          Weekly
        </button>
        <button
          className={`btn btn-sm ${view === 'monthly' ? 'btn-dark' : 'btn-outline-dark'}`}
          onClick={() => setView('monthly')}
        >
          Monthly
        </button>
      </div>

      {/* Pie chart */}
      {pieData.length === 0 ? (
        <p className="text-muted">No expense data for selected range.</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              outerRadius={100}
              label
            >
              {pieData.map((entry, index) => (
                <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default Dashboard;
