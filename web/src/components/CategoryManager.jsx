import {
  getCategories,
  addCategory,
  updateCategory,
  deleteCategory
} from '../utils/db';

import { useEffect, useState } from 'react';

const DEFAULT_COLOR = "#0d6efd";

function CategoryManager() {
  const [categories, setCategories] = useState([]);
  const [newCat, setNewCat] = useState('');
  const [newColor, setNewColor] = useState(DEFAULT_COLOR);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(DEFAULT_COLOR);

  useEffect(() => {
    getCategories().then(setCategories);
  }, []);

  const handleAdd = async () => {
    if (!newCat.trim()) return;
    await addCategory({ name: newCat.trim(), color: newColor });
    setNewCat('');
    setNewColor(DEFAULT_COLOR);
    setCategories(await getCategories());
  };

  const handleUpdate = async (id) => {
    if (!editName.trim()) return;
    await updateCategory(id, { name: editName.trim(), color: editColor });
    setEditId(null);
    setEditName('');
    setEditColor(DEFAULT_COLOR);
    setCategories(await getCategories());
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this category?')) {
      await deleteCategory(id);
      setCategories(await getCategories());
    }
  };

  return (
    <div className="card p-3 mb-4">
      <h5 className="mb-3">Manage Categories</h5>
      <div className="d-flex mb-2 gap-2 align-items-center">
        <input
          type="text"
          className="form-control form-control-sm"
          placeholder="New category name"
          value={newCat}
          onChange={e => setNewCat(e.target.value)}
        />
        <input
          type="color"
          className="form-control form-control-sm"
          style={{ width: 40, padding: 2 }}
          value={newColor}
          onChange={e => setNewColor(e.target.value)}
          title="Pick color"
        />
        <button className="btn btn-sm btn-success" onClick={handleAdd}>Add</button>
      </div>
      <ul className="list-group">
        {categories.map(cat =>
          <li key={cat.id} className="list-group-item d-flex align-items-center">
            {editId === cat.id ? (
              <>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  style={{ maxWidth: 120 }}
                />
                <input
                  type="color"
                  className="form-control form-control-sm ms-2"
                  style={{ width: 40, padding: 2 }}
                  value={editColor}
                  onChange={e => setEditColor(e.target.value)}
                  title="Pick color"
                />
                <div className="ms-auto d-flex gap-1">
                  <button className="btn btn-sm btn-primary" onClick={() => handleUpdate(cat.id)}>Save</button>
                  <button className="btn btn-sm btn-secondary" onClick={() => setEditId(null)}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <span className="d-flex align-items-center" style={{ gap: 8 }}>
                  <span style={{
                    display: 'inline-block',
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: cat.color || DEFAULT_COLOR,
                    border: '1px solid #ccc',
                    marginRight: 6
                  }} />
                  {cat.name}
                </span>
                <div className="ms-auto d-flex gap-1">
                  <button
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => {
                      setEditId(cat.id);
                      setEditName(cat.name);
                      setEditColor(cat.color || DEFAULT_COLOR);
                    }}
                  >Edit</button>
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => handleDelete(cat.id)}
                  >Delete</button>
                </div>
              </>
            )}
          </li>
        )}
      </ul>
    </div>
  );
}

export default CategoryManager;