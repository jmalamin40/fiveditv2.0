import { FormEvent, useEffect, useState } from 'react';
import {
  fetchScripts,
  createScript,
  updateScript,
  deleteScript,
  ScriptInput,
} from '../api';

interface Props {
  token: string;
}

const initialScriptForm = {
  id: '',
  name: '',
  category: '',
  shortDescription: '',
  description: '',
  codecanyonUrl: '',
  imageUrl: '',
  plansInput: '',
};

export default function ScriptsManager({ token }: Props) {
  const [scripts, setScripts] = useState<any[]>([]);
  const [form, setForm] = useState(initialScriptForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadScripts = async () => {
    try {
      setLoading(true);
      const data = await fetchScripts(token);
      setScripts(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load scripts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScripts();
  }, []);

  const resetForm = () => {
    setForm(initialScriptForm);
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

      const payload: ScriptInput = {
        id: form.id || undefined,
        name: form.name,
        category: form.category,
        shortDescription: form.shortDescription,
        description: form.description,
        codecanyonUrl: form.codecanyonUrl,
        imageUrl: form.imageUrl,
        plans: form.plansInput ? JSON.parse(form.plansInput) : [],
      };

      if (editingId) {
        await updateScript(token, editingId, payload);
      } else {
        await createScript(token, payload);
      }

      await loadScripts();
      resetForm();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save script. Check JSON format.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (script: any) => {
    setEditingId(script.id);
    setForm({
      id: script.id,
      name: script.name,
      category: script.category || '',
      shortDescription: script.short_description || '',
      description: script.description || '',
      codecanyonUrl: script.codecanyon_url || '',
      imageUrl: script.image_url || '',
      plansInput: JSON.stringify(
        (script.plans || []).map((plan: any) => ({
          id: plan.plan_id,
          name: plan.name,
          price: Number(plan.price),
          currency: plan.currency,
          description: plan.description,
          deliveryTime: plan.delivery_time,
          popular: !!plan.popular,
          features: (plan.features || []).map((feature: any) => ({
            name: feature.name,
            included: feature.included === 1 || feature.included === true,
          })),
        })),
        null,
        2,
      ),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this CodeCanyon script?')) {
      return;
    }
    try {
      await deleteScript(token, id);
      await loadScripts();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to delete script');
    }
  };

  return (
    <div className="grid">
      <div className="card-panel">
        <div className="section-header">
          <div>
            <h2>{editingId ? 'Edit Script' : 'Create Script'}</h2>
            <p>Manage CodeCanyon installation offerings.</p>
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
              Script Name *
              <input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </label>
            <label>
              Script ID (optional)
              <input
                value={form.id}
                onChange={(e) => setForm((prev) => ({ ...prev, id: e.target.value }))}
                disabled={!!editingId}
                placeholder="laravel-script-1"
              />
            </label>
          </div>

          <div className="split">
            <label>
              Category
              <input
                value={form.category}
                onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                placeholder="E-Commerce"
              />
            </label>
            <label>
              CodeCanyon URL
              <input
                value={form.codecanyonUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, codecanyonUrl: e.target.value }))}
                placeholder="https://codecanyon.net/item/..."
              />
            </label>
          </div>

          <label>
            Short Description
            <textarea
              rows={2}
              value={form.shortDescription}
              onChange={(e) => setForm((prev) => ({ ...prev, shortDescription: e.target.value }))}
            />
          </label>

          <label>
            Detailed Description
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </label>

          <label>
            Plans JSON
            <textarea
              rows={8}
              placeholder='[{"id":"basic","name":"Install","price":120,"features":[{"name":"Setup","included":true}]}]'
              value={form.plansInput}
              onChange={(e) => setForm((prev) => ({ ...prev, plansInput: e.target.value }))}
            />
            <small style={{ color: '#6b7280' }}>
              Plans should include <code>id</code>, <code>name</code>, <code>price</code>, and{' '}
              <code>features</code> arrays similar to the services plans.
            </small>
          </label>

          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : editingId ? 'Update Script' : 'Create Script'}
          </button>
        </form>
      </div>

      <div className="card-panel">
        <div className="section-header">
          <div>
            <h2>CodeCanyon Scripts</h2>
            <p>Manage installation offerings shown on the marketing site.</p>
          </div>
        </div>

        {loading ? (
          <p>Loading scripts…</p>
        ) : scripts.length === 0 ? (
          <p>No scripts configured yet.</p>
        ) : (
          <div>
            {scripts.map((script) => (
              <div key={script.id} className="item-row">
                <div>
                  <strong>{script.name}</strong>
                  <div className="text-sm" style={{ color: '#6b7280' }}>
                    {script.id} · {script.category || 'Uncategorised'}
                  </div>
                  <div className="text-sm" style={{ marginTop: '0.35rem', color: '#4b5563' }}>
                    {(script.plans || []).length} plan(s)
                  </div>
                </div>
                <div className="row-actions">
                  <button className="btn-secondary" onClick={() => handleEdit(script)}>
                    Edit
                  </button>
                  <button className="btn-danger" onClick={() => handleDelete(script.id)}>
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


