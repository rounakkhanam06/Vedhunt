const mongoose = require('mongoose');
require('dotenv').config();
const Testimonial = require('../models/Testimonial');

// Copying the hardcoded testimonials from frontend constants to migrate them
const TESTIMONIALS = [
  {
    quote: "It really met my requirements. You guys were very patient even though there were delays from my side. The price was competitive and all our requirements were met. If somebody were to ask me for something similar, I would definitely recommend you guys!",
    author: "Reshma S.",
    role: "E-commerce Founder",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150&h=150&fit=crop",
    country: "India",
    countryFlag: "🇮🇳"
  },
  {
    quote: "Working with Vedhunt was extremely professional. They took our complex reporting workflow and transformed it into a fully automated Power BI dashboard. Saves our department 15 hours every single week.",
    author: "Piyush K.",
    role: "Finance Director",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&h=150&fit=crop",
    country: "India",
    countryFlag: "🇮🇳"
  },
  {
    quote: "Their SEO service is top-notch. Our organic search leads increased by nearly 180% within four months. They are very analytical and direct with their projections.",
    author: "Shweta G.",
    role: "Real Estate Marketer",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&h=150&fit=crop",
    country: "United States",
    countryFlag: "🇺🇸"
  },
  {
    quote: "Vedhunt designed our corporate brand identity and logo. They understood our values instantly and gave us options that we absolutely loved. Exceptional branding service!",
    author: "Ajay Sharma",
    role: "SaaS Co-Founder",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=150&h=150&fit=crop",
    country: "United Kingdom",
    countryFlag: "🇬🇧"
  },
  {
    quote: "The web development team was fast, structured, and very transparent. Communication was perfect throughout the project lifecycle. Highly recommended for premium website development.",
    author: "Akash Bansal",
    role: "Retail Director",
    avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=150&h=150&fit=crop",
    country: "Canada",
    countryFlag: "🇨🇦"
  },
  {
    quote: "Their UI/UX design process completely blew us away. They created an interactive mobile application prototype that helped us secure our pre-seed funding round. Outstanding strategic partners!",
    author: "Karan Malhotra",
    role: "FinTech Founder",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=150&h=150&fit=crop",
    country: "Australia",
    countryFlag: "🇦🇺"
  },
  {
    quote: "Absolutely phenomenal results with their digital marketing campaigns. Our brand engagement grew by over 300% and direct inquiries skyrocketed within weeks. The team is hyper-responsive and highly skilled.",
    author: "Nisha Patel",
    role: "Creative Director",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=150&h=150&fit=crop",
    country: "United States",
    countryFlag: "🇺🇸"
  },
  {
    quote: "The custom CRM platform they built for us has streamlined our entire sales operations and team reporting. It is extremely fast, secure, and intuitive. Exceptional product engineering team!",
    author: "Vikram Seth",
    role: "Operations Head",
    avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=150&h=150&fit=crop",
    country: "United Arab Emirates",
    countryFlag: "🇦🇪"
  }
];

const migrate = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    for (const t of TESTIMONIALS) {
      // Avoid inserting duplicates
      const exists = await Testimonial.findOne({ quote: t.quote });
      if (!exists) {
        await Testimonial.create({
          ...t,
          status: 'approved',
          source: 'system' // mark as system/hardcoded origin
        });
        console.log(`Inserted: ${t.author}`);
      } else {
        console.log(`Skipped duplicate: ${t.author}`);
      }
    }
    
    console.log('Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrate();
