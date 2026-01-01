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
import { useGroup } from '../contexts/GroupContext';
import Modal from 'react-modal';

Modal.setAppElement('#root');

function TransactionList() {
  const { currentGroup } = useGroup();
  const [transactions, setTransactions] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [categories, setCategories] = useState([]);
  const [user, setUser] = useState(null);

  // Editing state
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    id: '',
    name: '',
    type: 'expense',
    categoryId: '',
    category: '', // legacy
    date: '',
    amount: 0,
  });

  // Filter state
  const [categoryFilterOpen, setCategoryFilterOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState([]);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const db = await initDB();
      const tx = db.transaction('transactions', 'readwrite');
      const { category, ...cleanForm } = editForm; // Exclude legacy name string
      await tx.store.put({
        ...cleanForm,
        amount: parseFloat(editForm.amount),
        lastModified: new Date().toISOString(),
        groupId: currentGroup?.id,
      });
      await tx.done;

      setEditModalOpen(false);
      await fetchTransactions();
      toast.success("Transaction updated successfully");
    } catch (error) {
      console.error("Update failed:", error);
      toast.error("Failed to update transaction");
    }
  };

  const fetchTransactions = async () => {
    if (!currentGroup) {
      setTransactions([]);
      setFiltered([]);
      return;
    }
    const db = await initDB();
    const index = db.transaction('transactions').store.index('groupId');
    const all = await index.getAll(currentGroup.id);

    const active = all.filter(txn => !txn.deleted);
    const sorted = active.sort((a, b) => new Date(b.date) - new Date(a.date));
    setTransactions(sorted);
    setFiltered(sorted);
  };

  const applyFilter = () => {
    let filteredTxns = transactions;

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

    if (selectedCategories.length > 0) {
      filteredTxns = filteredTxns.filter(txn => {
        const catObj = categories.find(c => c.id === txn.categoryId);
        const catName = catObj ? catObj.name : txn.category;
        return selectedCategories.includes(catName);
      });
    }

    setFiltered(filteredTxns);
  };

  useEffect(() => {
    if (currentGroup) {
      const fetchCategories = async () => {
        const result = await getCategories(currentGroup.id);
        setCategories(result);
      };
      fetchCategories();
    }
  }, [currentGroup]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filtered]);

  useEffect(() => {
    fetchTransactions();
  }, [currentGroup]);

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
    const dataToExport = filtered;
    if (dataToExport.length === 0) {
      toast.info("No transactions to export");
      return;
    }
    const rows = [
      ['Name', 'Type', 'Category', 'Date', 'Amount'],
      ...dataToExport.map(txn => [
        txn.name,
        txn.type,
        txn.category,
        new Date(txn.date).toLocaleDateString('en-IN'),
        txn.amount
      ])
    ];
    const csvContent = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `transactions_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const openEditModal = (txn) => {
    setEditForm({
      ...txn,
      date: txn.date ? new Date(txn.date).toISOString().split('T')[0] : ''
    });
    setEditModalOpen(true);
  };

  // Helper to get category color
  const getCatColor = (id, name) => {
    const cat = categories.find(c => c.id === id);
    if (cat && cat.color) return cat.color;
    return '#64748b'; // slate-500 default
  };

  return (
    <div className="py-2">
      <ToastContainer position="bottom-right" autoClose={3000} />

      {/* Header Actions */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h5 className="mb-0 fw-bold text-dark">History</h5>
        <div className="d-flex gap-2">
          <button
            className="btn btn-white border shadow-sm btn-sm d-flex align-items-center gap-2"
            onClick={handleExportCSV}
            title="Export CSV"
          >
            <span>⬇️</span> <span className="d-none d-md-inline">Export</span>
          </button>
          <button
            className="btn btn-white border shadow-sm btn-sm d-flex align-items-center gap-2"
            onClick={async () => { await syncAll() }}
            title="Sync with cloud"
            disabled={!user}
          >
            <span>🔁</span> <span className="d-none d-md-inline">Sync</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card shadow-sm border-0 mb-4 bg-white">
        <div className="card-body p-3">
          <div className="d-flex flex-column flex-md-row gap-3 align-items-md-center justify-content-between">

            {/* Date Filters */}
            <div className="d-flex gap-2">
              <div className="d-flex align-items-center gap-2 bg-light rounded px-2 py-1 border">
                <span className="text-secondary small">From</span>
                <DatePicker
                  selected={startDate}
                  onChange={(date) => setStartDate(date)}
                  dateFormat="dd/MM/yyyy"
                  className="form-control-plaintext form-control-sm p-0 fw-bold text-dark"
                  placeholderText="Start"
                  style={{ width: '85px' }}
                />
              </div>
              <div className="d-flex align-items-center gap-2 bg-light rounded px-2 py-1 border">
                <span className="text-secondary small">To</span>
                <DatePicker
                  selected={endDate}
                  onChange={(date) => setEndDate(date)}
                  dateFormat="dd/MM/yyyy"
                  className="form-control-plaintext form-control-sm p-0 fw-bold text-dark"
                  placeholderText="End"
                  style={{ width: '85px' }}
                />
              </div>
            </div>

            {/* Category Filter */}
            <div className="position-relative">
              <button
                className="btn btn-light border w-100 d-flex justify-content-between align-items-center"
                style={{ minWidth: '200px' }}
                onClick={() => setCategoryFilterOpen(!categoryFilterOpen)}
              >
                <span className="small text-secondary">{selectedCategories.length === 0 ? "All Categories" : `${selectedCategories.length} selected`}</span>
                <small>▼</small>
              </button>

              {categoryFilterOpen && (
                <div
                  className="category-filter-dropdown shadow-lg rounded p-2"
                  style={{
                    position: 'absolute',
                    top: '110%',
                    right: 0,
                    zIndex: 50,
                    background: '#fff',
                    width: '100%',
                    minWidth: '220px',
                    maxHeight: '250px',
                    overflowY: 'auto',
                    border: '1px solid #e2e8f0'
                  }}
                >
                  <div className="form-check mb-2 pb-2 border-bottom">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={selectedCategories.length === 0}
                      onChange={() => setSelectedCategories([])}
                      id="cat-all"
                    />
                    <label className="form-check-label small fw-bold" htmlFor="cat-all">All Categories</label>
                  </div>
                  {categories.map((cat) => (
                    <div key={cat.id} className="form-check mb-1">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={selectedCategories.includes(cat.name)}
                        onChange={() => {
                          if (selectedCategories.includes(cat.name)) {
                            setSelectedCategories(selectedCategories.filter(c => c !== cat.name));
                          } else {
                            setSelectedCategories([...selectedCategories, cat.name]);
                          }
                        }}
                        id={`cat-${cat.id}`}
                      />
                      <label className="form-check-label small" htmlFor={`cat-${cat.id}`}>{cat.name}</label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="card shadow-sm border-0">
        {filtered.length === 0 ? (
          <div className="p-5 text-center text-muted">
            <p className="mb-0">No transactions found matching your filters.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="table-responsive d-none d-md-block">
              <table className="table align-middle mb-0 table-hover">
                <thead className="bg-light">
                  <tr>
                    <th className="ps-4 text-secondary text-uppercase small" style={{ letterSpacing: '0.05em' }}>Description</th>
                    <th className="text-secondary text-uppercase small" style={{ letterSpacing: '0.05em' }}>Category</th>
                    <th className="text-secondary text-uppercase small" style={{ letterSpacing: '0.05em' }}>Date</th>
                    <th className="text-end pe-4 text-secondary text-uppercase small" style={{ letterSpacing: '0.05em' }}>Amount</th>
                    <th className="text-end pe-4" style={{ width: 100 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((txn) => {
                    const catObj = categories.find(c => c.id === txn.categoryId);
                    const catName = catObj ? catObj.name : txn.category;
                    const catColor = catObj ? catObj.color : '#ccc';
                    return (
                      <tr key={txn.id}>
                        <td className="ps-4">
                          <div className="fw-bold text-dark">{txn.name}</div>
                          <span className={`badge ${txn.type === 'income' ? 'bg-success bg-opacity-10 text-success' : 'bg-danger bg-opacity-10 text-danger'} rounded-pill small fw-normal`}>
                            {txn.type.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <span className="badge rounded-pill fw-normal text-dark border" style={{ backgroundColor: `${catColor}20`, borderColor: catColor }}>
                            {catName}
                          </span>
                        </td>
                        <td className="text-secondary small">
                          {new Date(txn.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className={`text-end pe-4 fw-bold ${txn.type === 'income' ? 'text-success' : 'text-danger'}`}>
                          {txn.type === 'income' ? '+' : '-'} ₹{txn.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="text-end pe-4">
                          <div className="d-flex gap-2 justify-content-end opacity-50 hover-opacity-100">
                            <button className="btn btn-sm btn-light text-primary" onClick={() => openEditModal(txn)}>✏️</button>
                            <button
                              className="btn btn-sm btn-light text-danger"
                              onClick={() => {
                                confirmAlert({
                                  title: 'Delete Transaction?',
                                  message: 'This cannot be undone.',
                                  buttons: [
                                    {
                                      label: 'Delete',
                                      onClick: async () => {
                                        await deleteTransaction(txn.id);
                                        await fetchTransactions();
                                        toast.success("Deleted");
                                      }
                                    },
                                    { label: 'Cancel' }
                                  ]
                                });
                              }}
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="d-md-none">
              {paginated.map((txn) => {
                const catObj = categories.find(c => c.id === txn.categoryId);
                const catName = catObj ? catObj.name : txn.category;
                const catColor = catObj ? catObj.color : '#ccc';
                return (
                  <div key={txn.id} className="p-3 border-bottom d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center gap-3">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                        style={{ width: 40, height: 40, backgroundColor: `${catColor}20`, color: catColor }}
                      >
                        <span className="fw-bold" style={{ fontSize: '0.8rem' }}>{catName[0]}</span>
                      </div>
                      <div>
                        <div className="fw-bold text-dark">{txn.name}</div>
                        <div className="d-flex align-items-center gap-2 small text-muted">
                          <span>{new Date(txn.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                          <span>•</span>
                          <span className={txn.type === 'income' ? 'text-success' : 'text-danger'}>{txn.type}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-end">
                      <div className={`fw-bold ${txn.type === 'income' ? 'text-success' : 'text-danger'}`}>
                        {txn.type === 'income' ? '+' : '-'} ₹{txn.amount.toLocaleString('en-IN')}
                      </div>
                      <div className="mt-1 d-flex gap-3 justify-content-end">
                        <button className="btn btn-xs btn-link p-0 text-muted text-decoration-none" onClick={() => openEditModal(txn)}>✏️ Edit</button>
                        <button
                          className="btn btn-xs btn-link p-0 text-danger text-decoration-none"
                          onClick={() => {
                            confirmAlert({
                              title: 'Delete Transaction?',
                              message: 'This cannot be undone.',
                              buttons: [
                                {
                                  label: 'Delete',
                                  onClick: async () => {
                                    await deleteTransaction(txn.id);
                                    await fetchTransactions();
                                    toast.success("Deleted");
                                  }
                                },
                                { label: 'Cancel' }
                              ]
                            });
                          }}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="card-footer bg-transparent border-top p-3 d-flex justify-content-between align-items-center">
                <button
                  className="btn btn-sm btn-white border"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  Previous
                </button>
                <span className="small text-muted">Page {currentPage} of {totalPages}</span>
                <button
                  className="btn btn-sm btn-white border"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onRequestClose={() => setEditModalOpen(false)}
        contentLabel="Edit Transaction"
        style={{
          overlay: { backgroundColor: 'rgba(15, 23, 42, 0.75)', zIndex: 1050 },
          content: {
            maxWidth: 500,
            margin: 'auto',
            padding: '2rem',
            borderRadius: '16px',
            border: 'none',
            background: '#fff',
            inset: '50% auto auto 50%',
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }
        }}
      >
        <h5 className="fw-bold mb-4">Edit Transaction</h5>
        <form onSubmit={handleUpdate}>
          <div className="mb-3">
            <label className="form-label small fw-bold text-secondary">Description</label>
            <input
              type="text"
              className="form-control"
              value={editForm.name}
              onChange={e => setEditForm({ ...editForm, name: e.target.value })}
            />
          </div>
          <div class="row g-3 mb-3">
            <div className="col-6">
              <label className="form-label small fw-bold text-secondary">Amount</label>
              <input
                type="number"
                className="form-control"
                value={editForm.amount}
                onChange={e => setEditForm({ ...editForm, amount: e.target.value })}
              />
            </div>
            <div className="col-6">
              <label className="form-label small fw-bold text-secondary">Date</label>
              <input
                type="date"
                className="form-control"
                value={editForm.date}
                onChange={e => setEditForm({ ...editForm, date: e.target.value })}
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="form-label small fw-bold text-secondary">Category</label>
            <select
              className="form-select"
              value={editForm.categoryId}
              onChange={e => {
                const cat = categories.find(c => c.id === e.target.value);
                if (cat) setEditForm({ ...editForm, categoryId: cat.id, category: cat.name });
              }}
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div className="d-flex gap-2 justify-content-end">
            <button type="button" className="btn btn-link text-secondary text-decoration-none" onClick={() => setEditModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary px-4">Save Changes</button>
          </div>
        </form>
      </Modal>

    </div>
  );
}

export default TransactionList;
