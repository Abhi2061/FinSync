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

  const getFilteredTransactions = () => {
    return transactions.filter(txn => !txn.deleted).filter((txn) => {
      const txnDate = new Date(txn.date);
      return view === 'daily'
        ? isSameDay(txnDate, selectedDate)
        : isSameMonth(txnDate, selectedMonth);
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
            '#4e485aff',
            '#198754',
            '#d63384',
            '#88b9ebff',
          ],
        },
      ],
    };
  };

  const filteredTxns = getFilteredTransactions();

  const chartData = generateChartData(
    filteredTxns.filter(txn => txn.type === 'expense')
  );

  const totalExpense = filteredTxns
    .filter(txn => txn.type === 'expense')
    .reduce((sum, txn) => sum + txn.amount, 0);

  const totalIncome = filteredTxns
    .filter(txn => txn.type === 'income')
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
      {filteredTxns.length === 0 ? (
        <div className="text-center text-muted mt-4">No data found</div>
      ) : (
        <div className="mb-4" style={{ maxWidth: 400, margin: '0 auto' }}>
          <div className="card text-center p-2 bg-light border-0 shadow-sm mb-3">
              {/* Summary Info */}
            <div className="text-center mb-3">
              {view === 'daily' ? (
                <h6 className="fw-semibold text-danger">
                  Total Expense: ₹{totalExpense.toLocaleString('en-IN')}
                </h6>
              ) : (
                <div className="d-flex flex-column align-items-center gap-1">
                  <h6 className="fw-semibold text-success">
                    Income: ₹{totalIncome.toLocaleString('en-IN')}
                  </h6>
                  <h6 className="fw-semibold text-danger">
                    Expense: ₹{totalExpense.toLocaleString('en-IN')}
                  </h6>
                  <h6 className={`fw-semibold ${balance >= 0 ? 'text-primary' : 'text-danger'}`}>
                    Balance: ₹{balance.toLocaleString('en-IN')}
                  </h6>
                </div>
              )}
            </div>
          </div>

          <Doughnut
            data={chartData}
            options={{
              plugins: {
                legend: {
                  display: true,
                  position: 'bottom', // ✅ show below the chart
                  labels: {
                    generateLabels: (chart) => {
                      const data = chart.data;
                      const dataset = data.datasets[0];

                      return data.labels.map((label, index) => {
                        const value = dataset.data[index];
                        const backgroundColor = dataset.backgroundColor[index];

                        return {
                          text: `${label}: ₹${value}`,
                          fillStyle: backgroundColor,
                          strokeStyle: backgroundColor,
                          index,
                        };
                      });
                    }
                  }
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
