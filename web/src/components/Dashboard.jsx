import React, { useEffect, useState } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import {
  isSameDay,
  isSameMonth,
  subDays,
  addDays,
  subMonths,
  addMonths,
} from 'date-fns';
import { initDB, getCategories } from '../utils/db';
import CategoryManager from './CategoryManager';
import { useGroup } from '../contexts/GroupContext';

ChartJS.register(ArcElement, Tooltip, Legend);

function Dashboard() {
  const { currentGroup } = useGroup();
  const [transactions, setTransactions] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [view, setView] = useState('daily'); // 'daily' or 'monthly'
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!currentGroup) {
        setTransactions([]);
        return;
      }
      const db = await initDB();
      const index = db.transaction('transactions').store.index('groupId');
      const all = await index.getAll(currentGroup.id);
      setTransactions(all);
    };
    fetchTransactions();
  }, [currentGroup]);

  useEffect(() => {
    if (currentGroup) {
      getCategories(currentGroup.id).then(setCategories);
    }
  }, [currentGroup]);

  const getFilteredTransactions = () => {
    return transactions.filter(txn => !txn.deleted).filter((txn) => {
      // Trip workspaces aggregate all transactions, no date filtering
      if (currentGroup?.type === 'trip') return true;

      const txnDate = new Date(txn.date);
      return view === 'daily'
        ? isSameDay(txnDate, selectedDate)
        : isSameMonth(txnDate, selectedMonth);
    });
  };

  const generateChartData = (txns) => {
    const categoryMap = {}; // ID -> Amount
    txns.forEach((txn) => {
      // Prioritize ID. If ID exists, use it. If not, use legacy name.
      // If both missing, use 'Uncategorized'
      const key = txn.categoryId || txn.category || 'Uncategorized';
      categoryMap[key] = (categoryMap[key] || 0) + txn.amount;
    });

    const labels = [];
    const dataPoints = [];
    const bgColors = [];

    Object.keys(categoryMap).forEach(key => {
      const amount = categoryMap[key];
      const catObj = categories.find(c => c.id === key);
      let displayName = key;
      let color = "#3b82f6";

      if (catObj) {
        displayName = catObj.name;
        color = catObj.color || "#3b82f6";
      } else {
        const catByName = categories.find(c => c.name === key);
        if (catByName) {
          color = catByName.color || "#3b82f6";
        }
      }

      labels.push(displayName);
      dataPoints.push(amount);
      bgColors.push(color);
    });

    return {
      labels,
      datasets: [
        {
          data: dataPoints,
          backgroundColor: bgColors,
          borderWidth: 0,
        },
      ],
    };
  };

  const filteredTxns = getFilteredTransactions();

  // Logic: Show only expenses for daily view. Show all for monthly.
  const chartTxns = filteredTxns.filter(txn => txn.type && txn.type.toLowerCase() === 'expense')

  const chartData = generateChartData(chartTxns);

  const totalExpense = filteredTxns
    .filter(txn => txn.type && txn.type.toLowerCase() === 'expense')
    .reduce((sum, txn) => sum + txn.amount, 0);

  const totalIncome = filteredTxns
    .filter(txn => txn.type && txn.type.toLowerCase() === 'income')
    .reduce((sum, txn) => sum + txn.amount, 0);

  const balance = totalIncome - totalExpense;

  const handlePrev = () => {
    if (view === 'daily') {
      setSelectedDate((prev) => subDays(prev, 1));
    } else {
      setSelectedMonth((prev) => subMonths(prev, 1));
    }
  };

  const handleNext = () => {
    if (view === 'daily') {
      setSelectedDate((prev) => addDays(prev, 1));
    } else {
      setSelectedMonth((prev) => addMonths(prev, 1));
    }
  };

  return (
    <div className="py-2">

      {/* Controls: Toggle & Date */}
      {currentGroup?.type !== 'trip' && (
      <div className="d-flex flex-column flex-md-row align-items-center justify-content-between gap-3 mb-4">
        {/* Toggle */}
        <div className="d-flex gap-2">
          <button
            className={`btn ${view === 'daily' ? 'btn-primary' : 'btn-outline-primary'} px-4 d-flex align-items-center gap-2`}
            onClick={() => setView('daily')}
          >
            <span>📅</span> Daily
          </button>
          <button
            className={`btn ${view === 'monthly' ? 'btn-primary' : 'btn-outline-primary'} px-4 d-flex align-items-center gap-2`}
            onClick={() => setView('monthly')}
          >
            <span>📊</span> Monthly
          </button>
        </div>

        {/* Date Nav */}
        <div className="d-flex align-items-center gap-2 bg-white rounded-pill px-3 py-1 shadow-sm border">
          <button className="btn btn-sm text-secondary" onClick={handlePrev}>❮</button>

          <div className="text-center" style={{ minWidth: '140px' }}>
            {view === 'daily' ? (
              <DatePicker
                selected={selectedDate}
                onChange={setSelectedDate}
                dateFormat="dd MMMM yyyy"
                className="form-control-plaintext text-center fw-bold text-primary p-0 m-0 w-100 cursor-pointer"
                onFocus={(e) => e.target.blur()}
              />
            ) : (
              <DatePicker
                selected={selectedMonth}
                onChange={setSelectedMonth}
                showMonthYearPicker
                dateFormat="MMMM yyyy"
                className="form-control-plaintext text-center fw-bold text-primary p-0 m-0 w-100 cursor-pointer"
                onFocus={(e) => e.target.blur()}
              />
            )}
          </div>

          <button className="btn btn-sm text-secondary" onClick={handleNext}>❯</button>
        </div>
      </div>
      )}

      {/* Main Content */}
      <div className="row g-3 mb-4">
        {/* Stats Column */}
        <div className="col-12 col-md-5 d-flex flex-column gap-3">

          {currentGroup?.type === 'trip' ? (
            <>
              {/* Special Trip Header Cards */}
              <div className="card shadow-sm h-100">
                <div className="card-body text-center">
                  <div className="stat-card-title">Remaining Balance</div>
                  <div className={`stat-card-value ${balance >= 0 ? 'text-primary' : 'text-danger'}`}>
                    ₹{balance.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
              <div className="row g-2">
                <div className="col-6">
                  <div className="card shadow-sm h-100">
                    <div className="card-body text-center py-3 px-1">
                      <div className="stat-card-title text-success">Total Contributed</div>
                      <div className="h5 fw-bold mb-0 text-success">₹{totalIncome.toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                </div>
                <div className="col-6">
                  <div className="card shadow-sm h-100">
                    <div className="card-body text-center py-3 px-1">
                      <div className="stat-card-title text-danger">Total Spent</div>
                      <div className="h5 fw-bold mb-0 text-danger">₹{totalExpense.toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : view === 'daily' ? (
            /* Daily View: Show Only Expense */
            <div className="card shadow-sm h-100">
              <div className="card-body text-center d-flex flex-column align-items-center justify-content-center py-4">
                <div className="text-muted small fw-bold text-uppercase mb-2">Total Expense</div>
                <div className="display-6 fw-bold text-danger">₹{totalExpense.toLocaleString('en-IN')}</div>
              </div>
            </div>
          ) : (
            /* Monthly View: Show Balance, Income, Expense */
            <>
              {/* Balance Card */}
              <div className="card shadow-sm h-100">
                <div className="card-body text-center">
                  <div className="stat-card-title">Net Balance</div>
                  <div className={`stat-card-value ${balance >= 0 ? 'text-primary' : 'text-danger'}`}>
                    ₹{balance.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Income/Expense Cards */}
              <div className="row g-2">
                <div className="col-6">
                  <div className="card shadow-sm h-100">
                    <div className="card-body text-center py-3 px-1">
                      <div className="stat-card-title text-success">Income</div>
                      <div className="h5 fw-bold mb-0 text-success">₹{totalIncome.toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                </div>
                <div className="col-6">
                  <div className="card shadow-sm h-100">
                    <div className="card-body text-center py-3 px-1">
                      <div className="stat-card-title text-danger">Expense</div>
                      <div className="h5 fw-bold mb-0 text-danger">₹{totalExpense.toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

        </div>

        {/* Chart Column */}
        <div className="col-12 col-md-7">
          <div className="card shadow-sm h-100">
            <div className="card-body d-flex flex-column align-items-center justify-content-center">
              {chartTxns.length === 0 ? (
                <div className="text-center py-5">
                  <div className="text-muted mb-2" style={{ fontSize: '2rem' }}>📭</div>
                  <p className="text-muted fw-medium">No transactions found</p>
                </div>
              ) : (
                <div className="w-100" style={{ maxWidth: 320 }}>
                  <Doughnut
                    data={chartData}
                    options={{
                      cutout: '65%',
                      plugins: {
                        legend: {
                          display: true,
                          position: 'bottom',
                          labels: {
                            usePointStyle: true,
                            padding: 20,
                            font: { family: "'Inter', sans-serif", size: 11 }
                          }
                        }
                      }
                    }}
                  />
                  {/* Optional: Add clear indicator of what's being shown */}
                  <div className="text-center mt-3 small text-muted">
                    {currentGroup?.type === 'trip' ? 'Expense Distribution' : (view === 'daily' ? 'Expenses Breakdown' : 'All Transactions Breakdown')}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Contributions by Person - for Shared and Trip */}
      {(currentGroup?.type === 'shared' || currentGroup?.type === 'trip') && (
        <div className="card shadow-sm border-0 mb-4">
          <div className="card-header bg-white border-bottom py-3">
            <h6 className="mb-0 fw-bold">Contributions by Person</h6>
          </div>
          <div className="card-body p-0">
            <div className="list-group list-group-flush">
              {currentGroup.members?.map(uid => {
                const amount = filteredTxns
                  .filter(txn => txn.type === 'income' && txn.createdBy === uid)
                  .reduce((sum, txn) => sum + txn.amount, 0);
                const name = currentGroup.memberDetails?.[uid]?.displayName || 'Unknown';
                return (
                  <div key={uid} className="list-group-item p-3 d-flex justify-content-between align-items-center">
                    <div className="fw-medium text-dark">{name}</div>
                    <div className="fw-bold text-success">₹{amount.toLocaleString('en-IN')}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="mt-5">
        <CategoryManager />
      </div>
    </div>
  );
}

export default Dashboard;
