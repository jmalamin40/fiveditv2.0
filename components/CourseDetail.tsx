'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  BarChart3,
  Globe,
  Lock,
  PlayCircle,
  ShoppingCart,
} from 'lucide-react';
import { Course, CourseModule } from '@/lib/api';

interface CourseDetailProps {
  course: Course;
}

export default function CourseDetail({ course }: CourseDetailProps) {
  const router = useRouter();
  const hasDiscount = course.discount_price !== null && course.discount_price !== undefined && course.discount_price < course.price;
  const features = course.features || [];
  const requirements = course.requirements || [];
  const modules = course.modules || [];

  const handleEnroll = () => {
    router.push(`/courses/checkout?course=${encodeURIComponent(course.id)}`);
  };

  return (
    <section className="py-20 px-4 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto max-w-7xl">
        <Link href="/courses" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-8">
          <ArrowLeft size={18} />
          Back to Courses
        </Link>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg p-8 md:p-10 mb-8">
              {course.category && (
                <div className="inline-block bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
                  {course.category}
                </div>
              )}
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{course.title}</h1>
              <p className="text-lg text-gray-600 leading-relaxed mb-6">{course.short_description}</p>

              <div className="flex flex-wrap items-center gap-6 text-sm text-gray-600 mb-6">
                {course.instructor_name && <span>Instructor: <strong className="text-gray-900">{course.instructor_name}</strong></span>}
                {course.level && (
                  <span className="flex items-center gap-1 capitalize">
                    <BarChart3 size={16} /> {course.level}
                  </span>
                )}
                {course.duration && (
                  <span className="flex items-center gap-1">
                    <Clock size={16} /> {course.duration}
                  </span>
                )}
                {course.language && (
                  <span className="flex items-center gap-1">
                    <Globe size={16} /> {course.language}
                  </span>
                )}
              </div>

              {course.description && (
                <p className="text-gray-700 leading-relaxed whitespace-pre-line">{course.description}</p>
              )}
            </div>

            {features.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-8 md:p-10 mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">What you&apos;ll learn</h2>
                <ul className="grid md:grid-cols-2 gap-3">
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="text-green-600 flex-shrink-0 mt-0.5" size={18} />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {modules.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-8 md:p-10 mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Curriculum</h2>
                <CurriculumAccordion modules={modules} />
              </div>
            )}

            {requirements.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-8 md:p-10">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Requirements</h2>
                <ul className="space-y-2">
                  {requirements.map((req, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-blue-600 mt-1">&bull;</span>
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-24">
              {course.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={course.thumbnail} alt={course.title} className="w-full h-40 object-cover rounded-xl mb-6" />
              )}

              <div className="mb-6">
                {hasDiscount ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-blue-600">
                      {course.currency} {Number(course.discount_price).toFixed(2)}
                    </span>
                    <span className="text-lg text-gray-400 line-through">
                      {course.currency} {Number(course.price).toFixed(2)}
                    </span>
                  </div>
                ) : (
                  <span className="text-3xl font-bold text-blue-600">
                    {course.currency} {Number(course.price).toFixed(2)}
                  </span>
                )}
              </div>

              {course.is_enrolled ? (
                <div className="w-full text-center py-3 rounded-lg font-semibold bg-green-100 text-green-700">
                  You&apos;re enrolled
                </div>
              ) : (
                <button
                  onClick={handleEnroll}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3 rounded-lg font-semibold hover:shadow-xl transition-all hover:scale-105"
                >
                  <ShoppingCart size={18} />
                  Enroll Now
                </button>
              )}

              <div className="mt-6 space-y-3 text-sm text-gray-600">
                {course.level && (
                  <div className="flex items-center justify-between">
                    <span>Level</span>
                    <span className="font-medium text-gray-900 capitalize">{course.level}</span>
                  </div>
                )}
                {course.duration && (
                  <div className="flex items-center justify-between">
                    <span>Duration</span>
                    <span className="font-medium text-gray-900">{course.duration}</span>
                  </div>
                )}
                {course.language && (
                  <div className="flex items-center justify-between">
                    <span>Language</span>
                    <span className="font-medium text-gray-900">{course.language}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CurriculumAccordion({ modules }: { modules: CourseModule[] }) {
  const [expanded, setExpanded] = useState<number | null>(modules[0]?.id ?? null);

  return (
    <div className="space-y-3">
      {modules.map((module) => {
        const isOpen = expanded === module.id;
        return (
          <div key={module.id} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setExpanded(isOpen ? null : module.id)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <span className="font-semibold text-gray-900 text-left">{module.title}</span>
              {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {isOpen && (
              <ul className="divide-y divide-gray-100">
                {module.lessons.map((lesson) => (
                  <li key={lesson.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <span className="flex items-center gap-2 text-gray-700">
                      {lesson.video_url ? (
                        <PlayCircle size={16} className="text-blue-600" />
                      ) : (
                        <Lock size={16} className="text-gray-400" />
                      )}
                      {lesson.title}
                      {lesson.is_preview && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Preview</span>
                      )}
                    </span>
                    {lesson.duration && <span className="text-gray-500">{lesson.duration}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
