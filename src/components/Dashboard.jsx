import React, { useEffect, useState } from 'react';
import { Pie } from 'react-chartjs-2';
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
import { initDB } from '../utils/db';

ChartJS.register(ArcElement, Tooltip, Legend);

function Dashboard() {
  const [transactions, setTransactions] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [view, setView] = useState('daily'); // 'daily' or 'monthly'

  useEffect(() => {
    const fetchTransactions = async () => {
      const db = await initDB();
      const tx = db.transaction('transactions');
      const all = await tx.store.getAll();
      setTransactions(all);
    };
    fetchTransactions();
  }, []);

  const getFilteredExpenses = () => {
    return transactions.filter((txn) => {
      const txnDate = new Date(txn.date);
      return (
        txn.type === 'expense' &&
        (view === 'daily'
          ? isSameDay(txnDate, selectedDate)
          : isSameMonth(txnDate, selectedMonth))
      );
    });
  };

  const generateChartData = (txns) => {
    const categoryMap = {};
    txns.forEach((txn) => {
      categoryMap[txn.category] =
        (categoryMap[txn.category] || 0) + txn.amount;
    });

    return {
      labels: Object.keys(categoryMap),
      datasets: [
        {
          data: Object.values(categoryMap),
          backgroundColor: [
            '#0d6efd',
            '#dc3545',
            '#ffc107',
            '#20c997',
            '#6610f2',
            '#fd7e14',
          ],
        },
      ],
    };
  };

  const expenses = getFilteredExpenses();
  const chartData = generateChartData(expenses);

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
    <div className="container py-2">
      {/* Toggle buttons */}
      <div className="d-flex justify-content-center gap-2 mb-3">
        <button
          className={`btn btn-sm ${
            view === 'daily' ? 'btn-primary' : 'btn-outline-primary'
          }`}
          onClick={() => setView('daily')}
        >
          📅 Daily
        </button>
        <button
          className={`btn btn-sm ${
            view === 'monthly' ? 'btn-primary' : 'btn-outline-primary'
          }`}
          onClick={() => setView('monthly')}
        >
          📊 Monthly
        </button>
      </div>

      {/* Date/month selector + nav */}
      <div className="d-flex flex-column align-items-center justify-content-center gap-2 mb-3 text-center">
        
        <div>
          {view === 'daily' ? (
            <DatePicker
              selected={selectedDate}
              onChange={setSelectedDate}
              dateFormat="dd-MMMM-yyyy"
              className="form-control form-control-sm text-center"
            />
          ) : (
            <DatePicker
              selected={selectedMonth}
              onChange={setSelectedMonth}
              showMonthYearPicker
              dateFormat="MMMM-yyyy"
              className="form-control form-control-sm text-center"
            />
          )}
        </div>

        <div className="d-flex gap-3 justify-content-center">
          <button className="btn btn-outline-secondary btn-sm" onClick={handlePrev}>
            ⬅️ Prev
          </button>
          <button className="btn btn-outline-secondary btn-sm" onClick={handleNext}>
            Next ➡️
          </button>
        </div>
      </div>

        {/* Chart or no data */}
      {expenses.length === 0 ? (
        <div className="text-center text-muted mt-4">No data found</div>
      ) : (
        <div className="mb-4" style={{ maxWidth: 400, margin: '0 auto' }}>
          <Pie
            data={chartData}
            options={{
              plugins: {
                legend: {
                  display: true,
                  position: 'bottom' // ✅ show below the chart
                }
              }
            }}
          />
        </div>
      )}
    </div>
  );
}

export default Dashboard;
