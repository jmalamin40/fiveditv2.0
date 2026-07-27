import { Suspense } from 'react'
import Header from '@/components/Header'
import CoursesList from '@/components/CoursesList'
import Contact from '@/components/Contact'
import Footer from '@/components/Footer'
import Chat from '@/components/Chat'

export const metadata = {
  title: 'Courses - FivedIT',
  description: 'Learn in-demand tech skills with hands-on courses taught by industry practitioners.',
}

export default function CoursesPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <CoursesList />
        <Suspense fallback={<div className="py-20 px-4">Loading...</div>}>
          <Contact />
        </Suspense>
      </main>
      <Footer />
      <Chat />
    </div>
  )
}
