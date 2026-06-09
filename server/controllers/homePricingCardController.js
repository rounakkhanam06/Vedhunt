const HomePricingCard = require('../models/HomePricingCard');
const logger = require('../utils/logger');
const slugify = require('slugify');

// @desc    Get all home pricing cards
// @route   GET /api/home-pricing
// @access  Public
exports.getHomePricingCards = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.showOnHome === 'true') {
      filter.showOnHome = true;
    }
    if (req.query.slug) {
      filter.slug = req.query.slug;
    }

    const cards = await HomePricingCard.find(filter).lean();
    res.status(200).json({ success: true, count: cards.length, data: cards });
  } catch (error) {
    logger.error('Error fetching home pricing cards', error);
    next(error);
  }
};

// @desc    Create a home pricing card
// @route   POST /api/home-pricing
// @access  Private (Admin)
exports.createHomePricingCard = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (!data.slug && data.title) {
      data.slug = slugify(data.title, { lower: true, strict: true });
    }

    const card = await HomePricingCard.create(data);
    res.status(201).json({ success: true, data: card });
  } catch (error) {
    logger.error('Error creating home pricing card', error);
    next(error);
  }
};

// @desc    Update a home pricing card
// @route   PUT /api/home-pricing/:id
// @access  Private (Admin)
exports.updateHomePricingCard = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (!data.slug && data.title) {
      data.slug = slugify(data.title, { lower: true, strict: true });
    }

    const card = await HomePricingCard.findByIdAndUpdate(req.params.id, data, {
      new: true,
      runValidators: true,
    });

    if (!card) {
      return res.status(404).json({ success: false, message: 'Pricing card not found' });
    }

    res.status(200).json({ success: true, data: card });
  } catch (error) {
    logger.error('Error updating home pricing card', error);
    next(error);
  }
};

// @desc    Delete a home pricing card
// @route   DELETE /api/home-pricing/:id
// @access  Private (Admin)
exports.deleteHomePricingCard = async (req, res, next) => {
  try {
    const card = await HomePricingCard.findByIdAndDelete(req.params.id);

    if (!card) {
      return res.status(404).json({ success: false, message: 'Pricing card not found' });
    }

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    logger.error('Error deleting home pricing card', error);
    next(error);
  }
};

// @desc    Seed home pricing cards if empty
exports.seedHomePricingCards = async () => {
  try {
    const count = await HomePricingCard.countDocuments();
    if (count === 0) {
      logger.info('Seeding initial home pricing cards...');
      const initialCards = [
        {
          title: "Website Development",
          slug: "website-development",
          showOnHome: true,
          icon: "Laptop",
          description: "High-performance web applications & corporate sites.",
          color: "from-blue-500/20",
          popular: false,
          tiers: {
            starter: {
              price: "₹15K-30K",
              period: "",
              features: [
                "Single/Multi-page Landing Site", 
                "Mobile Responsive Design", 
                "Basic SEO Setup", 
                "1 Month Free Support"
              ]
            },
            growth: {
              price: "₹35K-75K",
              period: "",
              features: [
                "Custom UI/UX Design", 
                "CMS Integration (WordPress/Webflow)", 
                "Advanced Speed Optimization", 
                "3 Months Priority Support"
              ]
            },
            enterprise: {
              price: "₹80K+",
              period: "",
              features: [
                "Full Custom Web Application", 
                "MERN / Next.js Stack", 
                "Advanced Security & Scalability", 
                "Dedicated Support & Maintenance"
              ]
            }
          }
        },
        {
          title: "Social Media Management",
          slug: "social-media",
          showOnHome: true,
          icon: "Share2",
          description: "Viral content strategies & brand authority building.",
          color: "from-primary/20",
          popular: true,
          tiers: {
            starter: {
              price: "₹6K",
              period: "/mo",
              features: [
                "12 High-Quality Posts/Reels", 
                "2 Platforms (IG + FB)", 
                "Basic Hashtag Strategy", 
                "Monthly Analytics Report"
              ]
            },
            growth: {
              price: "₹12K",
              period: "/mo",
              features: [
                "20 Posts/Reels + Stories", 
                "3 Platforms (IG + FB + LI)", 
                "Community Engagement", 
                "Bi-Weekly Strategy Review"
              ]
            },
            enterprise: {
              price: "₹22K+",
              period: "/mo",
              features: [
                "Daily Posts + Premium Reels", 
                "4+ Social Platforms", 
                "Influencer Strategy Setup", 
                "Dedicated Account Manager"
              ]
            }
          }
        },
        {
          title: "Performance Marketing",
          slug: "performance-marketing",
          showOnHome: true,
          icon: "TrendingUp",
          description: "KPI-driven paid ad campaigns for maximum ROI.",
          color: "from-purple-500/20",
          popular: false,
          tiers: {
            starter: {
              price: "₹8K",
              period: "/mo",
              features: [
                "Meta OR Google Ads Setup", 
                "Ad Copy & Creative Guidance", 
                "Basic Pixel/Tracking Setup", 
                "Monthly Performance Review"
              ]
            },
            growth: {
              price: "₹18K",
              period: "/mo",
              features: [
                "Meta AND Google Ads Setup", 
                "A/B Testing & Retargeting", 
                "Advanced Conversion Tracking", 
                "Bi-Weekly Optimization Calls"
              ]
            },
            enterprise: {
              price: "₹35K+",
              period: "/mo",
              features: [
                "Omnichannel Scaling Setup", 
                "Custom Funnel Optimization", 
                "High-Budget Scaling Strategy", 
                "Real-Time Dashboard Access"
              ]
            }
          }
        }
      ];
      await HomePricingCard.insertMany(initialCards);
      logger.info('Successfully seeded home pricing cards');
    }
  } catch (error) {
    logger.error('Error seeding home pricing cards', error);
  }
};
