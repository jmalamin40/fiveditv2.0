import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import ServiceDetail from '@/components/ServiceDetail'
import Contact from '@/components/Contact'
import Footer from '@/components/Footer'
import Chat from '@/components/Chat'
import { fetchServiceById } from '@/lib/api'

export async function generateMetadata({ params }: { params: { id: string } }) {
  try {
    const service = await fetchServiceById(params.id)
    return {
      title: `${service.title} - Service Plans | FivedIT`,
      description: service.short,
    }
  } catch {
    return {
      title: 'Service Not Found - FivedIT',
    }
  }
}

export default async function ServiceDetailPage({ params }: { params: { id: string } }) {
  let service;
  try {
    service = await fetchServiceById(params.id)
  } catch {
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

