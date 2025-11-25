import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import CodeCanyonScriptDetail from '@/components/CodeCanyonScriptDetail'
import Contact from '@/components/Contact'
import Footer from '@/components/Footer'
import Chat from '@/components/Chat'
import { fetchCodeCanyonScriptById } from '@/lib/api'

export async function generateMetadata({ params }: { params: { id: string } }) {
  try {
    const script = await fetchCodeCanyonScriptById(params.id)
    return {
      title: `${script.name} - Installation Plans | FivedIT`,
      description: script.shortDescription,
    }
  } catch {
    return {
      title: 'Script Not Found - FivedIT',
    }
  }
}

export default async function CodeCanyonScriptPage({ params }: { params: { id: string } }) {
  let script;
  try {
    script = await fetchCodeCanyonScriptById(params.id)
  } catch {
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

