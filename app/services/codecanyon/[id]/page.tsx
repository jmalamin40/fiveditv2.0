import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import CodeCanyonScriptDetail from '@/components/CodeCanyonScriptDetail'
import Contact from '@/components/Contact'
import Footer from '@/components/Footer'
import Chat from '@/components/Chat'
import { getScriptById } from '@/lib/codecanyon-scripts'

export async function generateMetadata({ params }: { params: { id: string } }) {
  const script = getScriptById(params.id)
  
  if (!script) {
    return {
      title: 'Script Not Found - FivedIT',
    }
  }

  return {
    title: `${script.name} - Installation Plans | FivedIT`,
    description: script.shortDescription,
  }
}

export default function CodeCanyonScriptPage({ params }: { params: { id: string } }) {
  const script = getScriptById(params.id)

  if (!script) {
    notFound()
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <CodeCanyonScriptDetail script={script} />
        <Suspense fallback={<div className="py-20 px-4">Loading...</div>}>
          <Contact />
        </Suspense>
      </main>
      <Footer />
      <Chat />
    </div>
  )
}

