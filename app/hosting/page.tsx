import { Suspense } from 'react'
import Header from '@/components/Header'
import HostingPlans from '@/components/HostingPlans'
import Contact from '@/components/Contact'
import Footer from '@/components/Footer'
import Chat from '@/components/Chat'

export const metadata = {
  title: 'Web Hosting Plans - FivedIT',
  description: 'Affordable and reliable web hosting plans with SSD storage, free SSL, daily backups, and 24/7 support. Choose from Starter, Business, Professional, or Enterprise plans.',
}

export default function HostingPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <HostingPlans />
        <Suspense fallback={<div className="py-20 px-4">Loading...</div>}>
          <Contact />
        </Suspense>
      </main>
      <Footer />
      <Chat />
    </div>
  )
}

