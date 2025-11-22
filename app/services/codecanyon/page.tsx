import { Suspense } from 'react'
import Header from '@/components/Header'
import CodeCanyonScripts from '@/components/CodeCanyonScripts'
import Contact from '@/components/Contact'
import Footer from '@/components/Footer'
import Chat from '@/components/Chat'

export const metadata = {
  title: 'CodeCanyon Script Installation Service - FivedIT',
  description: 'Professional CodeCanyon script installation with Basic, Standard, and Advanced plans. Expert installation and configuration services.',
}

export default function CodeCanyonPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <CodeCanyonScripts />
        <Suspense fallback={<div className="py-20 px-4">Loading...</div>}>
          <Contact />
        </Suspense>
      </main>
      <Footer />
      <Chat />
    </div>
  )
}

