import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import ServiceDetail from '@/components/ServiceDetail'
import Contact from '@/components/Contact'
import Footer from '@/components/Footer'
import Chat from '@/components/Chat'
import { getServiceWithPlansById } from '@/lib/services-data'

export async function generateMetadata({ params }: { params: { id: string } }) {
  const service = getServiceWithPlansById(params.id)
  
  if (!service) {
    return {
      title: 'Service Not Found - FivedIT',
    }
  }

  return {
    title: `${service.title} - Service Plans | FivedIT`,
    description: service.short,
  }
}

export default function ServiceDetailPage({ params }: { params: { id: string } }) {
  const service = getServiceWithPlansById(params.id)

  if (!service) {
    notFound()
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <ServiceDetail service={service} />
        <Suspense fallback={<div className="py-20 px-4">Loading...</div>}>
          <Contact />
        </Suspense>
      </main>
      <Footer />
      <Chat />
    </div>
  )
}

