import { motion } from 'framer-motion';
import Hero from '../components/home/Hero';
import ServicesPreview from '../components/home/ServicesPreview';
import WhyChooseUs from '../components/home/WhyChooseUs';
import ComparisonTable from '../components/home/ComparisonTable';
import StatsCounter from '../components/home/StatsCounter';
import Testimonials from '../components/home/Testimonials';
import PortfolioPreview from '../components/home/PortfolioPreview';
import PricingPreview from '../components/home/PricingPreview';
import PresenceMap from '../components/home/PresenceMap';
import CTABanner from '../components/home/CTABanner';

export default function Home() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-app-bg text-app-text-muted min-h-screen"
    >
      {/* Dynamic Animated Hero Area */}
      <Hero />

      {/* Services Preview Grid */}
      <ServicesPreview />

      {/* Corporate Strengths Metric Segment */}
      <WhyChooseUs />

      {/* Trust-Building Comparison Matrix */}
      <ComparisonTable />

      {/* Dynamic Animated Stats Section */}
      <StatsCounter />

      {/* Premium Drag-First Testimonials Slider (wearestokt.com design) */}
      <Testimonials />

      {/* Sleek Portfolio Grid */}
      <PortfolioPreview />

      {/* Strategic Pricing Preview for Ad Traffic */}
      <PricingPreview />

      {/* Nationwide Presence Map */}
      <PresenceMap />

      {/* Action Billboard Banner */}
      <CTABanner />
    </motion.div>
  );
}
