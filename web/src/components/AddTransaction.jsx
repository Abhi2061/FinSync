import { useEffect, useState } from 'react';
import { addTransaction, getCategories, addCategory } from '../utils/db';
import { v4 as uuidv4 } from 'uuid';
import 'react-datepicker/dist/react-datepicker.css';
import DatePicker from 'react-datepicker';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Modal from 'react-modal';

const DEFAULT_COLOR = "#0d6efd";
Modal.setAppElement('#root');

function AddTransaction() {
  const [form, setForm] = useState({
    name: '',
    type: 'expense',
    category: '',
    date: new Date().toISOString().split('T')[0],
    amount: ''
  });

  const [categories, setCategories] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState(DEFAULT_COLOR);

  // Load categories on mount
  useEffect(() => {
    getCategories().then(setCategories);
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.category || !form.date || !form.amount) {
      toast.warning("All fields are required");
      return;
    }

    const newTxn = {
      ...form,
      id: uuidv4(),
      amount: parseFloat(form.amount),
      date: new Date(form.date).toISOString(),
      lastModified: new Date().toISOString(),
      deleted: false
    };

    await addTransaction(newTxn);

    toast.success("Transaction added successfully");
    setForm({ name: '', type: 'expense', category: '', date: new Date().toISOString().split('T')[0], amount: '' });
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) {
      toast.warning("Category name required");
      return;
    }
    try {
      await addCategory({ name: newCatName.trim(), color: newCatColor });
      toast.success("Category added");
      const updated = await getCategories();
      setCategories(updated);
      setForm({ ...form, category: newCatName.trim() });
      setModalOpen(false);
      setNewCatName('');
      setNewCatColor(DEFAULT_COLOR);
    } catch (error) {
      toast.error("Failed to add category");
    }
  };

  return (
    <div className="container mt-4">
      <h2 className="mb-3 text-center">➕ Add Transaction</h2>
      <ToastContainer position="bottom-right" autoClose={3000} />
      <form onSubmit={handleSubmit} className="row g-3 justify-content-center">
        <div className="col-12 col-md-6">
          <label className="form-label fw-medium">Name</label>
          <input
            type="text"
            className="form-control form-control-lg"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Enter transaction name"
          />
        </div>

        <div className="col-12 col-md-6">
          <label className="form-label fw-medium">Type</label>
          <select
            className="form-select form-select-lg"
            name="type"
            value={form.type}
            onChange={handleChange}
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </div>

        <div className="col-12 col-md-6">
          <label className="form-label fw-medium">Category</label>
          <div className="input-group">
            <select
              className="form-select form-select-lg"
              name="category"
              value={form.category}
              onChange={async (e) => {
                const value = e.target.value;
                if (value === '__new') {
                  setModalOpen(true);
                } else {
                  setForm({ ...form, category: value });
                }
              }}
            >
              <option value="">-- Select Category --</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
              <option value="__new">➕ Add New...</option>
            </select>
          </div>
        </div>

        <div className="col-12 col-md-6">
          <label className="form-label fw-medium">Date</label>
          <DatePicker
            selected={new Date(form.date)}
            onChange={(date) =>
              setForm({ ...form, date: date.toISOString().split('T')[0] })
            }
            dateFormat="dd/MM/yyyy"
            className="form-control form-control-lg"
          />
        </div>

        <div className="col-12 col-md-6">
          <label className="form-label fw-medium">Amount</label>
          <input
            type="number"
            className="form-control form-control-lg"
            name="amount"
            value={form.amount}
            onChange={handleChange}
            placeholder="Enter amount"
            min="0"
            step="0.01"
          />
        </div>

        <div className="col-12 text-center mt-3">
          <button className="btn btn-primary btn-lg px-5" type="submit">
            Save Transaction
          </button>
        </div>
      </form>

      {/* Category Modal */}
      <Modal
        isOpen={modalOpen}
        onRequestClose={() => setModalOpen(false)}
        contentLabel="Add Category"
        style={{
          overlay: {
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1000
          },
          content: {
            maxWidth: 350,
            margin: 'auto',
            padding: '2rem',
            borderRadius: '12px',
            border: '1px solid #ccc',
            background: '#fff',
            inset: '50% auto auto 50%',
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.15)'
          }
        }}
      >
        <h5 className="mb-3 text-center">Add New Category</h5>
        <form onSubmit={handleAddCategory}>
          <div className="mb-3">
            <label className="form-label fw-medium">Category Name</label>
            <input
              type="text"
              className="form-control form-control-lg"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              autoFocus
              placeholder="Enter category name"
            />
          </div>
          <div className="mb-3">
            <label className="form-label fw-medium">Color</label>
            <input
              type="color"
              className="form-control"
              style={{ width: 48, height: 48, padding: 2 }}
              value={newCatColor}
              onChange={e => setNewCatColor(e.target.value)}
              title="Pick color"
            />
          </div>
          <div className="d-flex gap-2 justify-content-center mt-3">
            <button type="submit" className="btn btn-success btn-lg px-4">Add</button>
            <button type="button" className="btn btn-secondary btn-lg px-4" onClick={() => setModalOpen(false)}>Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default AddTransaction;
