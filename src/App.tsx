import Header from './components/Header';
import Hero from './components/Hero';
import About from './components/About';
import Services from './components/Services';
import Technologies from './components/Technologies';
import WhyChooseUs from './components/WhyChooseUs';
import Industries from './components/Industries';
import Contact from './components/Contact';
import Footer from './components/Footer';
import Chat from './components/Chat';
function App() {
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
        <Contact />
      </main>
      <Footer />
      <Chat />
    </div>
  );
}

export default App;
