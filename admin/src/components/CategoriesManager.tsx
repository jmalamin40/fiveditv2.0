import { FormEvent, useEffect, useState } from 'react';
import {
  Category,
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../api';

interface Props {
  token: string;
}

const initialForm: Partial<Category> = {
  id: '',
  name: '',
  description: '',
};

export default function CategoriesManager({ token }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await fetchCategories(token);
      setCategories(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name) {
      setError('Name is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      if (editingId) {
        await updateCategory(token, editingId, {
          name: form.name,
          description: form.description,
        });
      } else {
        await createCategory(token, form);
      }
      await loadCategories();
      resetForm();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingId(category.id);
    setForm({
      id: category.id,
      name: category.name,
      description: category.description,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this category? Services referencing it will lose their category.')) {
      return;
    }
    try {
      await deleteCategory(token, id);
      await loadCategories();
      if (editingId === id) {
        resetForm();
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to delete category');
    }
  };

  return (
    <div className="grid">
      <div className="card-panel">
        <div className="section-header">
          <div>
            <h2>{editingId ? 'Edit Category' : 'Create Category'}</h2>
            <p>Define service groupings for the marketing site.</p>
          </div>
          {editingId && (
            <button className="btn-secondary" onClick={resetForm}>
              Cancel edit
            </button>
          )}
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="split">
            <label>
              Display Name *
              <input
                value={form.name || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Infrastructure & DevOps"
                required
              />
            </label>
            <label>
              Category ID (optional)
              <input
                value={form.id || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, id: e.target.value }))}
                placeholder="infrastructure"
                disabled={!!editingId}
              />
            </label>
          </div>

          <label>
            Description
            <textarea
              rows={3}
              value={form.description || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </label>

          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : editingId ? 'Update Category' : 'Create Category'}
          </button>
        </form>
      </div>

      <div className="card-panel">
        <div className="section-header">
          <div>
            <h2>Existing Categories</h2>
            <p>Used by public services list.</p>
          </div>
        </div>

        {loading ? (
          <p>Loading categories…</p>
        ) : categories.length === 0 ? (
          <p>No categories yet.</p>
        ) : (
          <div>
            {categories.map((category) => (
              <div key={category.id} className="item-row">
                <div>
                  <strong>{category.name}</strong>
                  <div className="text-sm" style={{ color: '#6b7280' }}>
                    {category.id} · {category.slug}
                  </div>
                  {category.description && (
                    <div className="text-sm" style={{ marginTop: '0.25rem' }}>
                      {category.description}
                    </div>
                  )}
                </div>
                <div className="row-actions">
                  <button className="btn-secondary" onClick={() => handleEdit(category)}>
                    Edit
                  </button>
                  <button className="btn-danger" onClick={() => handleDelete(category.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


