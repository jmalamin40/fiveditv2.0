'use client'

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, GraduationCap, Clock, BarChart3 } from 'lucide-react';
import { fetchCourses, Course } from '@/lib/api';

export default function CoursesList() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  useEffect(() => {
    const loadCourses = async () => {
      try {
        const data = await fetchCourses();
        setCourses(data);
      } catch (error) {
        console.error('Error loading courses:', error);
      } finally {
        setLoading(false);
      }
    };
    loadCourses();
  }, []);

  const categories = ['All', ...Array.from(new Set(courses.map((c) => c.category).filter((cat): cat is string => Boolean(cat))))];

  const filteredCourses = selectedCategory === 'All' ? courses : courses.filter((c) => c.category === selectedCategory);

  return (
    <section className="py-20 px-4 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto max-w-7xl">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-gray-900">
            Our <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">Courses</span>
          </h1>
          <div className="w-24 h-1 bg-gradient-to-r from-blue-600 to-cyan-500 mx-auto mb-8"></div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Learn in-demand tech skills with hands-on, practitioner-taught courses.
          </p>
        </div>

        {categories.length > 1 && (
          <div className="flex flex-wrap justify-center gap-3 mb-12">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-6 py-2 rounded-lg font-medium transition-all ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-3 text-center py-12">
              <p className="text-gray-500">Loading courses...</p>
            </div>
          ) : filteredCourses.length > 0 ? (
            filteredCourses.map((course) => <CourseCard key={course.id} course={course} />)
          ) : (
            <div className="col-span-3 text-center py-12">
              <p className="text-gray-500">No courses found in this category.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function CourseCard({ course }: { course: Course }) {
  const hasDiscount = course.discount_price !== null && course.discount_price !== undefined && course.discount_price < course.price;

  return (
    <Link
      href={`/courses/${course.id}`}
      className="bg-white rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 border border-gray-100 overflow-hidden flex flex-col"
    >
      <div className="h-44 bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center overflow-hidden">
        {course.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
        ) : (
          <GraduationCap className="text-white" size={48} />
        )}
      </div>

      <div className="p-6 flex flex-col flex-1">
        {course.category && (
          <span className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-medium mb-3 self-start">
            {course.category}
          </span>
        )}

        <h3 className="text-xl font-bold mb-2 text-gray-900">{course.title}</h3>
        <p className="text-gray-600 leading-relaxed mb-4 flex-1">{course.short_description}</p>

        <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
          {course.level && (
            <span className="flex items-center gap-1 capitalize">
              <BarChart3 size={14} /> {course.level}
            </span>
          )}
          {course.duration && (
            <span className="flex items-center gap-1">
              <Clock size={14} /> {course.duration}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100">
          <div>
            {hasDiscount ? (
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-blue-600">
                  {course.currency} {Number(course.discount_price).toFixed(2)}
                </span>
                <span className="text-sm text-gray-400 line-through">
                  {course.currency} {Number(course.price).toFixed(2)}
                </span>
              </div>
            ) : (
              <span className="text-lg font-bold text-blue-600">
                {course.currency} {Number(course.price).toFixed(2)}
              </span>
            )}
          </div>
          <span className="inline-flex items-center gap-1 text-blue-600 font-medium text-sm">
            View Course <ArrowRight size={16} />
          </span>
        </div>
      </div>
    </Link>
  );
}
