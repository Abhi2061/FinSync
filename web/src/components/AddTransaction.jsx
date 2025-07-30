import { useEffect, useState } from 'react';
import { addTransaction, getCategories, addCategory } from '../utils/db';
import { v4 as uuidv4 } from 'uuid';
import 'react-datepicker/dist/react-datepicker.css';
import DatePicker from 'react-datepicker';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function AddTransaction() {
  const [form, setForm] = useState({
    name: '',
    type: 'expense',
    category: '',
    date: new Date().toISOString().split('T')[0], // default to today
    amount: ''
  });

  const [categories, setCategories] = useState([]);

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

  return (
    <div className="container mt-4">
      <h2 className="mb-3">➕ Add Transaction</h2>
      <ToastContainer position="bottom-right" autoClose={3000} />
      <form onSubmit={handleSubmit} className="row g-3">

        <div className="col-md-6">
          <label className="form-label">Name</label>
          <input type="text" className="form-control" name="name" value={form.name} onChange={handleChange} />
        </div>

        <div className="col-md-6">
          <label className="form-label">Type</label>
          <select className="form-select" name="type" value={form.type} onChange={handleChange}>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </div>

        <div className="col-md-6">
          <label className="form-label">Category</label>
          <div className="input-group">
            <select
              className="form-select"
              name="category"
              value={form.category}
              onChange={async (e) => {
                const value = e.target.value;
                if (value === '__new') {
                  const name = prompt('Enter new category name:');
                  if (name && name.trim()) {
                    await addCategory(name.trim());
                    const updated = await getCategories();
                    setCategories(updated);
                    setForm({ ...form, category: name.trim() });
                  }
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

        <div className="col-md-6">
          <label className="form-label">Date</label>
            <DatePicker
              selected={new Date(form.date)}
              onChange={(date) =>
                setForm({ ...form, date: date.toISOString().split('T')[0] })
              }
              dateFormat="dd/MM/yyyy"
              className="form-control"
            />

        </div>

        <div className="col-md-6">
          <label className="form-label">Amount</label>
          <input type="number" className="form-control" name="amount" value={form.amount} onChange={handleChange} />
        </div>

        <div className="col-12">
          <button className="btn btn-primary" type="submit">Save Transaction</button>
        </div>
      </form>
    </div>
  );
}

export default AddTransaction;
