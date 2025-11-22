import { Suspense } from 'react'
import Header from '@/components/Header'
import ServicesList from '@/components/ServicesList'
import Contact from '@/components/Contact'
import Footer from '@/components/Footer'
import Chat from '@/components/Chat'

export const metadata = {
  title: 'Our Services - FivedIT',
  description: 'Comprehensive technical solutions including VPS setup, Laravel installation, CodeCanyon scripts, AI development, microservices, and more.',
}

export default function ServicesPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <ServicesList />
        <Suspense fallback={<div className="py-20 px-4">Loading...</div>}>
          <Contact />
        </Suspense>
      </main>
      <Footer />
      <Chat />
    </div>
  )
}

