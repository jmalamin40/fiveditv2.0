import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import CourseDetail from '@/components/CourseDetail'
import Contact from '@/components/Contact'
import Footer from '@/components/Footer'
import Chat from '@/components/Chat'
import { fetchCourseById } from '@/lib/api'

export async function generateMetadata({ params }: { params: { id: string } }) {
  try {
    const course = await fetchCourseById(params.id)
    return {
      title: `${course.title} - Course | FivedIT`,
      description: course.short_description,
    }
  } catch {
    return {
      title: 'Course Not Found - FivedIT',
    }
  }
}

export default async function CourseDetailPage({ params }: { params: { id: string } }) {
  let course;
  try {
    course = await fetchCourseById(params.id)
  } catch {
    notFound()
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <CourseDetail course={course} />
        <Suspense fallback={<div className="py-20 px-4">Loading...</div>}>
          <Contact />
        </Suspense>
      </main>
      <Footer />
      <Chat />
    </div>
  )
}
