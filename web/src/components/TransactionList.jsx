import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { initDB } from '../utils/db';
import DatePicker from 'react-datepicker';
import { deleteTransaction, getCategories } from '../utils/db';
import { syncAll } from '../utils/cloudSync';
import 'react-datepicker/dist/react-datepicker.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';
import { saveAs } from 'file-saver';

function TransactionList() {
  const [transactions, setTransactions] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [editId, setEditId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [categories, setCategories] = useState([]);
  const [user, setUser] = useState(null);
  const [editForm, setEditForm] = useState({
    id: '',
    name: '',
    type: 'expense',
    category: '',
    date: '',
    amount: 0,
  });
  const [categoryFilterOpen, setCategoryFilterOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState([]);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleUpdate = async () => {
    try {
      const db = await initDB();
      const tx = db.transaction('transactions', 'readwrite');
      await tx.store.put({
        ...editForm,
        lastModified: new Date().toISOString(),
      });
      await tx.done;

      setEditId(null);
      await fetchTransactions();

      toast.success("Transaction updated successfully");
    } catch (error) {
      console.error("Update failed:", error);
      toast.error("Failed to update transaction");
    }
  };

  const fetchTransactions = async () => {
    const db = await initDB();
    const all = await db.getAll('transactions');
    const active = all.filter(txn => !txn.deleted); // Exclude soft-deleted transactions
    const sorted = active.sort((a, b) => new Date(b.date) - new Date(a.date));
    setTransactions(sorted);
    setFiltered(sorted);
  };

  const applyFilter = () => {
    let filteredTxns = transactions;

    // Date filter
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filteredTxns = filteredTxns.filter(txn => {
        const txnDate = new Date(txn.date);
        return txnDate >= start && txnDate <= end;
      });
    }

    // Category filter
    if (selectedCategories.length > 0) {
      filteredTxns = filteredTxns.filter(txn =>
        selectedCategories.includes(txn.category)
      );
    }

    setFiltered(filteredTxns);
  };

  useEffect(() => {
    const fetchCategories = async () => {
      const result = await getCategories(); // returns array from IndexedDB
      setCategories(result);
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [filtered]);

  useEffect(() => {
    fetchTransactions();
  }, []);

  useEffect(() => {
    applyFilter();
  }, [startDate, endDate]);

  useEffect(() => {
    applyFilter();
  }, [selectedCategories]);
  
  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  const paginated = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleExportCSV = () => {
    // Use your filtered list if available, or fallback to all
    const dataToExport = filtered;

    if (dataToExport.length === 0) {
      toast.info("No transactions to export");
      return;
    }

    // Format data as CSV rows
    const rows = [
      ['Name', 'Type', 'Category', 'Date', 'Amount'], // headers
      ...dataToExport.map(txn => [
        txn.name,
        txn.type,
        txn.category,
        new Date(txn.date).toLocaleDateString('en-IN'),
        txn.amount
      ])
    ];

    const csvContent = rows.map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;',
    });

    const fileName = `transactions_${new Date().toISOString().slice(0, 10)}.csv`;
    saveAs(blob, fileName);
  };

  useEffect(() => {
    if (!categoryFilterOpen) return;
    const handleClick = (e) => {
      if (!e.target.closest('.category-filter-dropdown')) {
        setCategoryFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [categoryFilterOpen]);

  return (
    <div className="container mt-4">
      <h2 className="mb-3 text-center">📋 Transactions</h2>
      <ToastContainer position="bottom-right" autoClose={3000} />

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
      <div className="d-flex align-items-center justify-content-between mb-3 gap-2" style={{ flex: 1 }}>
        <label className="me-2 fw-medium">Category:</label>
        <div style={{ position: 'relative', width: '100%' }}>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            style={{ minWidth: 120 }}
            onClick={() => setCategoryFilterOpen((open) => !open)}
          >
            {selectedCategories.length === 0 ? "All Categories" : `${selectedCategories.length} selected`}
          </button>
          {categoryFilterOpen && (
            <div
              className="category-filter-dropdown"
              style={{
                position: 'absolute',
                top: '110%',
                left: 0,
                zIndex: 10,
                background: '#fff',
                border: '1px solid #ccc',
                borderRadius: 6,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                padding: '8px',
                minWidth: 180,
                maxHeight: 220,
                overflowY: 'auto'
              }}
            >
              <div>
                <label className="d-block mb-1">
                  <input
                    type="checkbox"
                    checked={selectedCategories.length === 0}
                    onChange={() => setSelectedCategories([])}
                  />{" "}
                  All Categories
                </label>
                <hr className="my-1" />
                {categories.map((cat) => (
                  <label key={cat.id} className="d-block mb-1">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(cat.name)}
                      onChange={() => {
                        if (selectedCategories.includes(cat.name)) {
                          // Remove category
                          const updated = selectedCategories.filter(c => c !== cat.name);
                          setSelectedCategories(updated);
                        } else {
                          // Add category
                          setSelectedCategories([...selectedCategories, cat.name]);
                        }
                      }}
                    />{" "}
                    {cat.name}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>      

      {/* Export & Sync Buttons */}
      <div className="d-flex mb-2">
        <button
          className="btn btn-outline-success btn-sm"
          onClick={handleExportCSV}
        >
          ⬇️ Export to CSV
        </button>
        <button
          className="btn btn-outline-info btn-sm ms-auto"
          onClick={async () => { await syncAll() }}
          title="Sync with cloud"
          disabled={!user}
        >
          🔁
        </button>
      </div>

        {/* Transaction List */}
      {filtered.length === 0 ? (
        <p className="text-muted">No transactions found for selected range.</p>
      ) : (
        <div>
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
                          <select
                            className="form-select form-select-sm"
                            value={editForm.category}
                            onChange={(e) =>
                              setEditForm({ ...editForm, category: e.target.value })
                            }
                          >
                            <option value="">Select category</option>
                            {categories.map((cat, idx) => (
                              <option key={idx} value={cat.name}>{cat.name}</option>
                            ))}
                          </select>
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
                              onClick={() => {
                                confirmAlert({
                                  title: 'Confirm Deletion',
                                  message: 'Are you sure you want to delete this transaction?',
                                  buttons: [
                                    {
                                      label: 'Yes',
                                      onClick: async () => {
                                        await deleteTransaction(txn.id);
                                        await fetchTransactions();
                                        toast.success("Transaction deleted successfully");
                                      }
                                    },
                                    {
                                      label: 'No',
                                      onClick: () => toast.info("Deletion cancelled")
                                    }
                                  ]
                                });
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
          </div>
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
