import { useEffect, useState } from 'react';
import { addTransaction, getCategories, createCategory } from '../utils/db';
import { v4 as uuidv4 } from 'uuid';
import 'react-datepicker/dist/react-datepicker.css';
import DatePicker from 'react-datepicker';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Modal from 'react-modal';
import { useGroup } from '../contexts/GroupContext';

const DEFAULT_COLOR = "#0d6efd";
Modal.setAppElement('#root');

function AddTransaction() {
  const { currentGroup, currentUser } = useGroup();
  const [form, setForm] = useState({
    name: '',
    type: 'expense',
    category: '',
    categoryId: '',
    date: new Date().toISOString().split('T')[0],
    amount: ''
  });

  const [categories, setCategories] = useState([]);
  const [modalOpen, setModalOpen] = useState(false); // For "New Category" creation
  const [selectorOpen, setSelectorOpen] = useState(false); // For selecting from list

  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState(DEFAULT_COLOR);

  useEffect(() => {
    if (currentGroup) {
      getCategories(currentGroup.id).then(setCategories);
    } else {
      setCategories([]);
    }
  }, [currentGroup]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const selectType = (type) => {
    setForm(prev => ({ ...prev, type }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentGroup) {
      toast.error("Please create or join a group first!");
      return;
    }
    if (!form.name || (!form.categoryId && !form.category) || !form.date || !form.amount) {
      toast.warning("All fields are required");
      return;
    }

    const newTxn = {
      name: form.name,
      type: form.type,
      categoryId: form.categoryId,
      amount: parseFloat(form.amount),
      date: new Date(form.date).toISOString(),
      id: uuidv4(),
      lastModified: new Date().toISOString(),
      deleted: false,
      groupId: currentGroup.id,
      createdBy: currentUser.uid
    };

    await addTransaction(newTxn);
    toast.success("Transaction added successfully");
    setForm({ name: '', type: 'expense', category: '', categoryId: '', date: new Date().toISOString().split('T')[0], amount: '' });
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!currentGroup) {
      toast.error("No group selected");
      return;
    }
    if (!newCatName.trim()) {
      toast.warning("Category name required");
      return;
    }
    try {
      const newCatId = await createCategory({
        name: newCatName.trim(),
        color: newCatColor,
        groupId: currentGroup.id,
        createdBy: currentUser.uid
      });
      toast.success("Category added");
      const updated = await getCategories(currentGroup.id);
      setCategories(updated);
      setForm({ ...form, category: newCatName.trim(), categoryId: newCatId });
      setModalOpen(false);
      setSelectorOpen(false); // Close selector if open
      setNewCatName('');
      setNewCatColor(DEFAULT_COLOR);
    } catch (error) {
      toast.error("Failed to add category");
    }
  };

  // Custom Input for DatePicker to ensure padding works correctly
  const CustomDateInput = ({ value, onClick }) => (
    <input
      className="form-control form-control-lg bg-light border-0 w-100"
      onClick={onClick}
      value={value}
      readOnly
      style={{ paddingLeft: '45px', cursor: 'pointer' }}
    />
  );

  return (
    <div className="py-2">
      <ToastContainer position="bottom-right" autoClose={3000} />

      <div className="card shadow-sm border-0 overflow-hidden">
        <div className="card-header bg-white border-bottom py-3 px-4">
          <h5 className="mb-0 fw-bold text-dark">New Transaction</h5>
        </div>

        <div className="card-body p-4">
          <form onSubmit={handleSubmit}>
            {/* Transaction Type Toggles */}
            <div className="row mb-4">
              <div className="col-6">
                <button
                  type="button"
                  className={`btn w-100 py-3 d-flex flex-column align-items-center justify-content-center gap-2 border ${form.type === 'expense' ? 'bg-danger bg-opacity-10 border-danger text-danger' : 'bg-light border-light text-muted'}`}
                  onClick={() => selectType('expense')}
                >
                  <span style={{ fontSize: '1.25rem' }}>💸</span>
                  <span className="fw-bold">Expense</span>
                </button>
              </div>
              <div className="col-6">
                <button
                  type="button"
                  className={`btn w-100 py-3 d-flex flex-column align-items-center justify-content-center gap-2 border ${form.type === 'income' ? 'bg-success bg-opacity-10 border-success text-success' : 'bg-light border-light text-muted'}`}
                  onClick={() => selectType('income')}
                >
                  <span style={{ fontSize: '1.25rem' }}>💰</span>
                  <span className="fw-bold">Income</span>
                </button>
              </div>
            </div>

            <div className="row g-4">
              {/* Description */}
              <div className="col-12">
                <label className="form-label text-secondary small text-uppercase fw-bold">Description</label>
                <input
                  type="text"
                  className="form-control form-control-lg bg-light border-0"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="e.g. Grocery Shopping"
                />
              </div>

              {/* Amount */}
              <div className="col-12 col-md-6">
                <label className="form-label text-secondary small text-uppercase fw-bold">Amount</label>
                <div className="input-group input-group-lg">
                  <span className="input-group-text border-0 bg-light text-secondary fw-bold">₹</span>
                  <input
                    type="number"
                    className="form-control bg-light border-0"
                    name="amount"
                    value={form.amount}
                    onChange={handleChange}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              {/* Date - Fixed Layout with CustomInput */}
              <div className="col-12 col-md-6">
                <label className="form-label text-secondary small text-uppercase fw-bold">Date</label>
                <div className="position-relative">
                  <DatePicker
                    selected={new Date(form.date)}
                    onChange={(date) =>
                      setForm({ ...form, date: date.toISOString().split('T')[0] })
                    }
                    dateFormat="dd/MM/yyyy"
                    wrapperClassName="w-100"
                    customInput={<CustomDateInput />}
                  />
                  <div
                    className="position-absolute d-flex align-items-center justify-content-center text-secondary"
                    style={{
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none',
                      fontSize: '1.2rem'
                    }}
                  >
                    📅
                  </div>
                </div>
              </div>

              {/* Category Selector (Custom Div + Modal) */}
              <div className="col-12">
                <label className="form-label text-secondary small text-uppercase fw-bold">Category</label>
                <div
                  className="form-control form-control-lg bg-light border-0 d-flex justify-content-between align-items-center cursor-pointer"
                  onClick={() => setSelectorOpen(true)}
                  style={{ cursor: 'pointer' }}
                >
                  <span className={form.category ? "text-dark fw-medium" : "text-muted"}>
                    {form.category || "-- Select Category --"}
                  </span>
                  <span>▼</span>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <button className="btn btn-primary btn-lg w-100 py-3 fw-bold shadow-sm" type="submit">
                Add Transaction
              </button>
            </div>

          </form>
        </div>
      </div>

      {/* Category Selection Modal */}
      <Modal
        isOpen={selectorOpen}
        onRequestClose={() => setSelectorOpen(false)}
        contentLabel="Select Category"
        style={{
          overlay: { backgroundColor: 'rgba(15, 23, 42, 0.5)', zIndex: 1050 },
          content: {
            maxWidth: 500, // Increased width
            width: '95%',  // Better mobile width
            maxHeight: '80vh',
            margin: 'auto',
            padding: 0,
            borderRadius: '16px',
            border: 'none',
            background: '#fff',
            inset: '50% auto auto 50%',
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
      >
        <div className="p-3 border-bottom d-flex align-items-center justify-content-between bg-dark-navy text-white">
          <h6 className="mb-0 fw-bold">Select Category</h6>
          <button className="btn btn-sm btn-link text-white text-decoration-none" onClick={() => setSelectorOpen(false)}>Close</button>
        </div>
        <div className="p-0 overflow-auto flex-grow-1">
          {categories.length === 0 && (
            <div className="p-4 text-center text-muted">No categories found.</div>
          )}
          <div className="list-group list-group-flush">
            {categories.map(cat => (
              <button
                key={cat.id}
                className="list-group-item list-group-item-action p-3 d-flex align-items-center gap-3 border-bottom"
                onClick={() => {
                  setForm({ ...form, category: cat.name, categoryId: cat.id });
                  setSelectorOpen(false);
                }}
              >
                <span
                  className="rounded-circle d-inline-block shadow-sm"
                  style={{ width: 24, height: 24, backgroundColor: cat.color || '#ccc' }}
                ></span>
                <span className="fw-medium text-dark">{cat.name}</span>
                {form.categoryId === cat.id && <span className="ms-auto text-primary fw-bold">✔</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="p-3 border-top bg-light">
          <button
            className="btn btn-outline-primary w-100 dashed-border fw-bold py-2"
            onClick={() => {
              setSelectorOpen(false);
              setModalOpen(true); // Open creation modal
            }}
          >
            + Create New Category
          </button>
        </div>
      </Modal>

      {/* Create Category Modal */}
      <Modal
        isOpen={modalOpen}
        onRequestClose={() => setModalOpen(false)}
        contentLabel="Add Category"
        style={{
          overlay: { backgroundColor: 'rgba(15, 23, 42, 0.75)', zIndex: 1060 }, // Higher z-index
          content: {
            maxWidth: 400, // Increased width
            width: '90%',  // Better mobile width
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
        <div className="text-center mb-4">
          <h5 className="fw-bold mb-1">New Category</h5>
          <p className="text-muted small">Create a tag to organize your money</p>
        </div>

        <form onSubmit={handleAddCategory}>
          <div className="mb-3">
            <label className="form-label small fw-bold text-secondary">Name</label>
            <input
              type="text"
              className="form-control form-control-lg bg-light border-0"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              placeholder="e.g. Travel"
              autoFocus
            />
          </div>
          <div className="mb-4">
            <label className="form-label small fw-bold text-secondary">Color</label>
            <div className="p-2 bg-light rounded d-flex align-items-center justify-content-between cursor-pointer border-0">
              <div className="d-flex align-items-center gap-2">
                <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: newCatColor }}></div>
                <span className="text-muted small">Tap to pick color</span>
              </div>
              <input
                type="color"
                className="form-control form-control-color border-0 bg-transparent p-0 position-absolute opacity-0"
                value={newCatColor}
                onChange={e => setNewCatColor(e.target.value)}
                style={{ width: '100%', height: 50, left: 0, cursor: 'pointer' }}
              />
            </div>
          </div>
          <div className="d-grid gap-2">
            <button type="submit" className="btn btn-primary btn-lg">Create Category</button>
            <button type="button" className="btn btn-link text-secondary text-decoration-none" onClick={() => setModalOpen(false)}>Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default AddTransaction;
