import { FormEvent, useEffect, useState } from 'react';
import {
  fetchCourses,
  fetchCategories,
  createCourse,
  updateCourse,
  deleteCourse,
  CourseInput,
  Category,
} from '../api';

interface Props {
  token: string;
}

const initialCourseForm = {
  id: '',
  title: '',
  thumbnail: '',
  instructorName: '',
  level: 'beginner' as 'beginner' | 'intermediate' | 'advanced',
  language: 'English',
  duration: '',
  price: '',
  discountPrice: '',
  currency: 'BDT',
  categoryId: '',
  status: 'draft' as 'draft' | 'published',
  shortDescription: '',
  description: '',
  featuresInput: '',
  requirementsInput: '',
  modulesInput: '',
};

export default function CoursesManager({ token }: Props) {
  const [courses, setCourses] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(initialCourseForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [coursesData, categoriesData] = await Promise.all([
        fetchCourses(token),
        fetchCategories(token),
      ]);
      setCourses(coursesData);
      setCategories(categoriesData);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setForm(initialCourseForm);
    setEditingId(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.title || !form.price) {
      setError('Title and price are required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload: CourseInput = {
        id: form.id || undefined,
        title: form.title,
        thumbnail: form.thumbnail || undefined,
        instructorName: form.instructorName,
        level: form.level,
        language: form.language,
        duration: form.duration,
        price: Number(form.price),
        discountPrice: form.discountPrice ? Number(form.discountPrice) : null,
        currency: form.currency,
        categoryId: form.categoryId || undefined,
        status: form.status,
        shortDescription: form.shortDescription,
        description: form.description,
        features: form.featuresInput
          ? form.featuresInput.split(',').map((item) => item.trim()).filter(Boolean)
          : [],
        requirements: form.requirementsInput
          ? form.requirementsInput.split(',').map((item) => item.trim()).filter(Boolean)
          : [],
        modules: form.modulesInput ? JSON.parse(form.modulesInput) : [],
      };

      if (editingId) {
        await updateCourse(token, editingId, payload);
      } else {
        await createCourse(token, payload);
      }

      await loadData();
      resetForm();
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.error || 'Failed to save course. Ensure curriculum JSON is valid.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (course: any) => {
    setEditingId(course.id);
    setForm({
      id: course.id,
      title: course.title,
      thumbnail: course.thumbnail || '',
      instructorName: course.instructor_name || '',
      level: course.level || 'beginner',
      language: course.language || 'English',
      duration: course.duration || '',
      price: String(course.price ?? ''),
      discountPrice: course.discount_price !== null && course.discount_price !== undefined ? String(course.discount_price) : '',
      currency: course.currency || 'BDT',
      categoryId: course.category_id || '',
      status: course.status || 'draft',
      shortDescription: course.short_description || '',
      description: course.description || '',
      featuresInput: Array.isArray(course.features) ? course.features.join(', ') : '',
      requirementsInput: Array.isArray(course.requirements) ? course.requirements.join(', ') : '',
      modulesInput: JSON.stringify(
        (course.modules || []).map((module: any) => ({
          title: module.title,
          lessons: (module.lessons || []).map((lesson: any) => ({
            title: lesson.title,
            duration: lesson.duration,
            videoUrl: lesson.video_url,
            isPreview: !!lesson.is_preview,
          })),
        })),
        null,
        2,
      ),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this course? This action cannot be undone.')) {
      return;
    }
    try {
      await deleteCourse(token, id);
      await loadData();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to delete course');
    }
  };

  return (
    <div className="grid">
      <div className="card-panel">
        <div className="section-header">
          <div>
            <h2>{editingId ? 'Edit Course' : 'Create Course'}</h2>
            <p>Courses power the public catalog and checkout flow.</p>
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
              Course Title *
              <input
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                required
              />
            </label>
            <label>
              Course ID (optional)
              <input
                value={form.id}
                onChange={(e) => setForm((prev) => ({ ...prev, id: e.target.value }))}
                disabled={!!editingId}
                placeholder="advanced-react"
              />
            </label>
          </div>

          <div className="split">
            <label>
              Thumbnail URL
              <input
                value={form.thumbnail}
                onChange={(e) => setForm((prev) => ({ ...prev, thumbnail: e.target.value }))}
                placeholder="https://..."
              />
            </label>
            <label>
              Instructor
              <input
                value={form.instructorName}
                onChange={(e) => setForm((prev) => ({ ...prev, instructorName: e.target.value }))}
              />
            </label>
          </div>

          <div className="split">
            <label>
              Level
              <select
                value={form.level}
                onChange={(e) => setForm((prev) => ({ ...prev, level: e.target.value as any }))}
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>
            <label>
              Status
              <select
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as any }))}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </label>
          </div>

          <div className="split">
            <label>
              Language
              <input
                value={form.language}
                onChange={(e) => setForm((prev) => ({ ...prev, language: e.target.value }))}
              />
            </label>
            <label>
              Duration
              <input
                value={form.duration}
                onChange={(e) => setForm((prev) => ({ ...prev, duration: e.target.value }))}
                placeholder="12 hours"
              />
            </label>
          </div>

          <div className="split">
            <label>
              Price *
              <input
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
                required
              />
            </label>
            <label>
              Discount Price
              <input
                type="number"
                step="0.01"
                value={form.discountPrice}
                onChange={(e) => setForm((prev) => ({ ...prev, discountPrice: e.target.value }))}
              />
            </label>
          </div>

          <div className="split">
            <label>
              Currency
              <input
                value={form.currency}
                onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value }))}
              />
            </label>
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
            Long Description
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </label>

          <label>
            What you&apos;ll learn (comma separated)
            <textarea
              rows={2}
              placeholder="Build REST APIs, Deploy to production, Write tests"
              value={form.featuresInput}
              onChange={(e) => setForm((prev) => ({ ...prev, featuresInput: e.target.value }))}
            />
          </label>

          <label>
            Requirements (comma separated)
            <textarea
              rows={2}
              placeholder="Basic JavaScript, A computer with internet access"
              value={form.requirementsInput}
              onChange={(e) => setForm((prev) => ({ ...prev, requirementsInput: e.target.value }))}
            />
          </label>

          <label>
            Curriculum JSON
            <textarea
              rows={10}
              placeholder='[{"title":"Getting Started","lessons":[{"title":"Intro","duration":"5:00","videoUrl":"https://...","isPreview":true}]}]'
              value={form.modulesInput}
              onChange={(e) => setForm((prev) => ({ ...prev, modulesInput: e.target.value }))}
            />
            <small style={{ color: '#6b7280' }}>
              Provide an array of modules. Each module supports <code>title</code> and <code>lessons</code>; each
              lesson supports <code>title</code>, <code>duration</code>, <code>videoUrl</code>, and{' '}
              <code>isPreview</code>.
            </small>
          </label>

          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : editingId ? 'Update Course' : 'Create Course'}
          </button>
        </form>
      </div>

      <div className="card-panel">
        <div className="section-header">
          <div>
            <h2>Existing Courses</h2>
            <p>Click edit to modify curriculum or pricing.</p>
          </div>
        </div>

        {loading ? (
          <p>Loading courses…</p>
        ) : courses.length === 0 ? (
          <p>No courses configured yet.</p>
        ) : (
          <div>
            {courses.map((course) => (
              <div key={course.id} className="item-row">
                <div>
                  <strong>{course.title}</strong>
                  <div className="text-sm" style={{ color: '#6b7280' }}>
                    {course.id} · {course.status} · {course.category || 'Uncategorised'}
                  </div>
                  <div className="text-sm" style={{ marginTop: '0.35rem', color: '#4b5563' }}>
                    {(course.modules || []).length} module(s) · {course.currency} {Number(course.price).toFixed(2)}
                    {course.discount_price ? ` (discount: ${course.currency} ${Number(course.discount_price).toFixed(2)})` : ''}
                  </div>
                </div>
                <div className="row-actions">
                  <button className="btn-secondary" onClick={() => handleEdit(course)}>
                    Edit
                  </button>
                  <button className="btn-danger" onClick={() => handleDelete(course.id)}>
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
