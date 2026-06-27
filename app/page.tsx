import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import ProductUI from "@/components/ProductUI";
import Pipeline from "@/components/Pipeline";
import Features from "@/components/Features";
import Partners from "@/components/Partners";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main style={{ background: '#080c14', minHeight: '100vh' }}>
      <Navbar />
      <Hero />
      <ProductUI />
      <Pipeline />
      <Features />
      <Partners />
      <CTA />
      <Footer />
    </main>
  );
}
