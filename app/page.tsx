import { Suspense } from 'react'
import Header from '@/components/Header'
import Hero from '@/components/Hero'
import About from '@/components/About'
import Services from '@/components/Services'
import Technologies from '@/components/Technologies'
import WhyChooseUs from '@/components/WhyChooseUs'
import Industries from '@/components/Industries'
import CustomerReviews from '@/components/CustomerReviews'
import Contact from '@/components/Contact'
import Footer from '@/components/Footer'
import Chat from '@/components/Chat'

export default function Home() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        <About />
        <Services />
        <Technologies />
        <WhyChooseUs />
        <Industries />
        <CustomerReviews />
        <Suspense fallback={<div className="py-20 px-4">Loading...</div>}>
          <Contact />
        </Suspense>
      </main>
      <Footer />
      <Chat />
    </div>
  )
}

