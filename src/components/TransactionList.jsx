import { useEffect, useState } from 'react';
import { initDB } from '../utils/db';
import DatePicker from 'react-datepicker';
import { deleteTransaction } from '../utils/db';
import 'react-datepicker/dist/react-datepicker.css';

function TransactionList() {
  const [transactions, setTransactions] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [editId, setEditId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [editForm, setEditForm] = useState({
    id: '',
    name: '',
    type: 'expense',
    category: '',
    date: '',
    amount: 0,
  });

  const handleUpdate = async () => {
    const db = await initDB();
    const tx = db.transaction('transactions', 'readwrite');
    await tx.store.put(editForm);
    await tx.done;
    setEditId(null);
    await fetchTransactions();
  };

  const fetchTransactions = async () => {
    const db = await initDB();
    const all = await db.getAll('transactions');
    const sorted = all.sort((a, b) => new Date(b.date) - new Date(a.date));
    setTransactions(sorted);
    setFiltered(sorted);
  };

  const applyFilter = () => {
    if (!startDate || !endDate) {
        setFiltered(transactions);
        return;
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const filteredTxns = transactions.filter(txn => {
        const txnDate = new Date(txn.date);
        return txnDate >= start && txnDate <= end;
    });

    setFiltered(filteredTxns);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [filtered]);

  useEffect(() => {
    fetchTransactions();
  }, []);

  useEffect(() => {
    applyFilter();
  }, [startDate, endDate]);
  
  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  const paginated = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="container mt-4">
      <h2>📋 Transactions</h2>

      {/* Date Range Filter */}
      <div className="d-flex flex-wrap align-items-center justify-content-between mb-3 gap-2">
        {/* From date */}
        <div className="d-flex align-items-center" style={{ flex: 1 }}>
          <label className="me-2 fw-medium">From:</label>
          <DatePicker
            selected={startDate}
            onChange={(date) => setStartDate(date)}
            dateFormat="dd/MM/yyyy"
            className="form-control form-control-sm"
            placeholderText="Start Date"
            style={{ width: '160px' }}
          />
        </div>

        {/* To date */}
        <div className="d-flex align-items-center justify-content-end" style={{ flex: 1 }}>
          <label className="me-2 fw-medium">To:</label>
          <DatePicker
            selected={endDate}
            onChange={(date) => setEndDate(date)}
            dateFormat="dd/MM/yyyy"
            className="form-control form-control-sm"
            placeholderText="End Date"
            style={{ width: '160px' }}
          />
        </div>
      </div>

      {/* Transaction List */}
      {filtered.length === 0 ? (
        <p className="text-muted">No transactions found for selected range.</p>
      ) : (
        <div className="table-responsive" style={{ overflowX: 'auto' }}>
          <table className="table table-bordered table-hover">
            <thead className="table-light">
              <tr>
                <th style={{ minWidth: '100px' }}>Name</th>
                <th style={{ minWidth: '80px' }}>Type</th>
                <th style={{ minWidth: '100px' }}>Category</th>
                <th style={{ minWidth: '90px' }}>Date</th>
                <th className="text-end" style={{ minWidth: '100px' }}>Amount (₹)</th>
                <th style={{ minWidth: '100px' }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {paginated.map((txn) => (
                <tr key={txn.id}>
                  {editId === txn.id ? (
                    <>
                      <td>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        />
                      </td>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          value={editForm.type}
                          onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                        >
                          <option value="income">Income</option>
                          <option value="expense">Expense</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={editForm.category}
                          onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={editForm.date}
                          onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          value={editForm.amount}
                          onChange={(e) =>
                            setEditForm({ ...editForm, amount: parseFloat(e.target.value) || 0 })
                          }
                        />
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-success me-1"
                          onClick={handleUpdate}
                        >
                          ✅
                        </button>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => setEditId(null)}
                        >
                          ❌
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{txn.name}</td>
                      <td>{txn.type}</td>
                      <td>{txn.category}</td>
                      <td>{new Date(txn.date).toLocaleDateString('en-IN')}</td>
                      <td className="text-end">{txn.amount.toFixed(2)}</td>
                      <td className="text-nowrap">
                        <div className="d-flex gap-1">
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={async () => {
                              if (window.confirm("Are you sure you want to delete this transaction?")) {
                                await deleteTransaction(txn.id);
                                await fetchTransactions();
                              }
                            }}
                          >
                            🗑️
                          </button>
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => {
                              setEditId(txn.id);
                              setEditForm({ ...txn });
                            }}
                          >
                            ✏️
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}

            </tbody>
          </table>

          <div className="d-flex justify-content-between align-items-center mt-3">
            <button
              className="btn btn-outline-primary"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => prev - 1)}
            >
              ← Previous
            </button>

            <span>Page {currentPage} of {totalPages}</span>

            <button
              className="btn btn-outline-primary"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((prev) => prev + 1)}
            >
              Next →
            </button>
          </div>  
        </div>
      )}
    </div>
  );
}

export default TransactionList;
