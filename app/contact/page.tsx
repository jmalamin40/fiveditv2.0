import { Suspense } from 'react'
import Header from '@/components/Header'
import Contact from '@/components/Contact'
import Footer from '@/components/Footer'
import Chat from '@/components/Chat'

export const metadata = {
  title: 'Contact Us - FivedIT',
  description: 'Get in touch with FivedIT. Ready to build something great? Let\'s discuss your project and transform your technical infrastructure.',
}

export default function ContactPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-20">
        <Suspense fallback={<div className="py-20 px-4">Loading...</div>}>
          <Contact />
        </Suspense>
      </main>
      <Footer />
      <Chat />
    </div>
  )
}

