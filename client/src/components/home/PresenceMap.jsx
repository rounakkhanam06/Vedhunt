import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';

const locations = [
  { name: 'Kolkata', top: '48%', left: '70%', delay: 0 },
  { name: 'Mumbai', top: '65%', left: '28%', delay: 0.2 },
  { name: 'Indore', top: '52%', left: '36%', delay: 0.4 },
];

export default function PresenceMap() {
  return (
    <section className="py-24 relative overflow-hidden bg-app-bg text-app-text">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10 grid lg:grid-cols-2 gap-12 items-center">
        {/* Left Side: Text Content */}
        <div className="text-left">
          <motion.h2 
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6 }}
            className="text-4xl md:text-5xl font-black mb-6 tracking-tight"
          >
            Our <span className="text-primary text-gradient-orange">Presence</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-app-text-muted text-lg max-w-xl"
          >
            From thriving startup ecosystems to rapidly growing business hubs, our network spans across the nation—helping us deliver innovation, collaboration, and technology without boundaries.
          </motion.p>
        </div>

        {/* Right Side: Map */}
        <div className="relative w-full aspect-square flex items-center justify-center">
          {/* India Map Image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, x: 50 }}
            whileInView={{ opacity: 1, scale: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.8 }}
            className="relative w-full h-full flex justify-center items-center opacity-40 dark:opacity-20"
          >
            <img 
              src="/india.svg" 
              alt="India Map" 
              className="w-full h-full object-contain filter invert-0 dark:invert"
            />
          </motion.div>

          {/* Location Pins */}
          {locations.map((loc, idx) => (
            <motion.div
              key={idx}
              className="absolute flex flex-col items-center justify-center pointer-events-none"
              style={{ top: loc.top, left: loc.left }}
              initial={{ opacity: 0, scale: 0, y: 20 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true, amount: 0.8 }}
              transition={{ delay: 0.4 + loc.delay, type: 'spring', bounce: 0.5 }}
            >
              <div className="relative">
                {/* Ping Animation */}
                <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
                <div className="relative bg-app-bg p-2 rounded-full border border-primary/30 shadow-[0_0_15px_rgba(255,107,0,0.5)]">
                  <MapPin className="w-6 h-6 text-primary" />
                </div>
              </div>
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.8 + loc.delay }}
                className={`absolute top-full mt-2 whitespace-nowrap bg-primary/90 border border-primary/50 px-3 py-1.5 rounded-lg shadow-xl backdrop-blur-md text-sm font-bold z-20 ${
                  loc.name.toLowerCase() === 'indore' ? 'text-white' : 'text-white'
                }`}
              >
                {loc.name}
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
