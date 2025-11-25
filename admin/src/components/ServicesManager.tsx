import { FormEvent, useEffect, useState } from 'react';
import {
  fetchServices,
  fetchCategories,
  createService,
  updateService,
  deleteService,
  ServiceInput,
  Category,
} from '../api';

interface Props {
  token: string;
}

const initialServiceForm = {
  id: '',
  icon: 'Server',
  title: '',
  short: '',
  description: '',
  color: 'blue',
  categoryId: '',
  link: '',
  featuresInput: '',
  plansInput: '',
};

export default function ServicesManager({ token }: Props) {
  const [services, setServices] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(initialServiceForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [servicesData, categoriesData] = await Promise.all([
        fetchServices(token),
        fetchCategories(token),
      ]);
      setServices(servicesData);
      setCategories(categoriesData);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setForm(initialServiceForm);
    setEditingId(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.title || !form.icon) {
      setError('Title and icon are required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload: ServiceInput = {
        id: form.id || undefined,
        icon: form.icon,
        title: form.title,
        short: form.short,
        description: form.description,
        color: form.color as 'blue' | 'cyan',
        categoryId: form.categoryId || undefined,
        link: form.link || undefined,
        features: form.featuresInput
          ? form.featuresInput.split(',').map((item) => item.trim()).filter(Boolean)
          : [],
        plans: form.plansInput
          ? JSON.parse(form.plansInput)
          : [],
      };

      if (editingId) {
        await updateService(token, editingId, payload);
      } else {
        await createService(token, payload);
      }

      await loadData();
      resetForm();
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.error || 'Failed to save service. Ensure plan JSON is valid.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (service: any) => {
    setEditingId(service.id);
    setForm({
      id: service.id,
      icon: service.icon,
      title: service.title,
      short: service.short,
      description: service.description,
      color: service.color || 'blue',
      categoryId: service.category_id || '',
      link: service.link || '',
      featuresInput: Array.isArray(service.features) ? service.features.join(', ') : '',
      plansInput: JSON.stringify(
        (service.plans || []).map((plan: any) => ({
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
    if (!confirm('Delete this service? This action cannot be undone.')) {
      return;
    }
    try {
      await deleteService(token, id);
      await loadData();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to delete service');
    }
  };

  return (
    <div className="grid">
      <div className="card-panel">
        <div className="section-header">
          <div>
            <h2>{editingId ? 'Edit Service' : 'Create Service'}</h2>
            <p>Services power the marketing site and pricing pages.</p>
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
              Service Title *
              <input
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                required
              />
            </label>
            <label>
              Service ID (optional)
              <input
                value={form.id}
                onChange={(e) => setForm((prev) => ({ ...prev, id: e.target.value }))}
                disabled={!!editingId}
                placeholder="vps-setup"
              />
            </label>
          </div>

          <div className="split">
            <label>
              Icon *
              <input
                value={form.icon}
                onChange={(e) => setForm((prev) => ({ ...prev, icon: e.target.value }))}
                required
                placeholder="Server"
              />
            </label>
            <label>
              Accent Color
              <select
                value={form.color}
                onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
              >
                <option value="blue">Blue</option>
                <option value="cyan">Cyan</option>
              </select>
            </label>
          </div>

          <div className="split">
            <label>
              Category
              <select
                value={form.categoryId}
                onChange={(e) => setForm((prev) => ({ ...prev, categoryId: e.target.value }))}
              >
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Link
              <input
                value={form.link}
                onChange={(e) => setForm((prev) => ({ ...prev, link: e.target.value }))}
                placeholder="/services/vps-setup"
              />
            </label>
          </div>

          <label>
            Short Description
            <textarea
              rows={2}
              value={form.short}
              onChange={(e) => setForm((prev) => ({ ...prev, short: e.target.value }))}
            />
          </label>

          <label>
            Long Description
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </label>

          <label>
            Key Features (comma separated)
            <textarea
              rows={2}
              placeholder="Server provisioning, Security hardening, Monitoring"
              value={form.featuresInput}
              onChange={(e) => setForm((prev) => ({ ...prev, featuresInput: e.target.value }))}
            />
          </label>

          <label>
            Plans JSON
            <textarea
              rows={8}
              placeholder='[{"id":"basic","name":"Basic","price":149,"features":[{"name":"Item","included":true}]}]'
              value={form.plansInput}
              onChange={(e) => setForm((prev) => ({ ...prev, plansInput: e.target.value }))}
            />
            <small style={{ color: '#6b7280' }}>
              Provide an array of plans. Each plan supports <code>id</code>, <code>name</code>,{' '}
              <code>price</code>, <code>currency</code>, <code>description</code>,{' '}
              <code>deliveryTime</code>, <code>popular</code>, and <code>features</code>.
            </small>
          </label>

          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : editingId ? 'Update Service' : 'Create Service'}
          </button>
        </form>
      </div>

      <div className="card-panel">
        <div className="section-header">
          <div>
            <h2>Existing Services</h2>
            <p>Click edit to modify pricing plans or details.</p>
          </div>
        </div>

        {loading ? (
          <p>Loading services…</p>
        ) : services.length === 0 ? (
          <p>No services configured yet.</p>
        ) : (
          <div>
            {services.map((service) => (
              <div key={service.id} className="item-row">
                <div>
                  <strong>{service.title}</strong>
                  <div className="text-sm" style={{ color: '#6b7280' }}>
                    {service.id} · {service.category || 'Uncategorised'}
                  </div>
                  <div className="text-sm" style={{ marginTop: '0.35rem', color: '#4b5563' }}>
                    {(service.plans || []).length} plan(s) · {Array.isArray(service.features) ? service.features.length : 0}{' '}
                    feature(s)
                  </div>
                </div>
                <div className="row-actions">
                  <button className="btn-secondary" onClick={() => handleEdit(service)}>
                    Edit
                  </button>
                  <button className="btn-danger" onClick={() => handleDelete(service.id)}>
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

  // need continue

