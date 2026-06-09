const Portfolio = require('../models/Portfolio');
const PortfolioMetric = require('../models/PortfolioMetric');
const PortfolioCTA = require('../models/PortfolioCTA');
const PortfolioHero = require('../models/PortfolioHero');

// @desc    Get all portfolio items with pagination, filtering, and sorting
// @route   GET /api/portfolio
// @access  Public
const getPortfolioItems = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startIndex = (page - 1) * limit;

    let query = { status: 'active' };

    // Filter by category
    if (req.query.category && req.query.category !== 'all') {
      query.category = req.query.category;
    }

    // Filter by featured
    if (req.query.featured === 'true') {
      query.featured = true;
    }

    let total = await Portfolio.countDocuments(query);
    
    // Fallback logic: If we requested featured items but there are none, 
    // fall back to showing standard active items so the homepage never looks empty.
    if (req.query.featured === 'true' && total === 0) {
      delete query.featured;
      total = await Portfolio.countDocuments(query);
    }

    const totalPages = Math.ceil(total / limit);

    // Sort by displayOrder first, then newest first
    const portfolios = await Portfolio.find(query)
      .sort({ displayOrder: 1, createdAt: -1 })
      .skip(startIndex)
      .limit(limit);

    res.status(200).json({
      success: true,
      count: portfolios.length,
      pagination: {
        page,
        limit,
        total,
        totalPages
      },
      data: portfolios,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all portfolio items for Admin (including inactive)
// @route   GET /api/portfolio/admin
// @access  Private/Admin
const getAllAdminPortfolioItems = async (req, res) => {
  try {
    const portfolios = await Portfolio.find().sort({ displayOrder: 1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: portfolios.length,
      data: portfolios,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single portfolio item
// @route   GET /api/portfolio/:id
// @access  Public
const getPortfolioItem = async (req, res) => {
  try {
    const portfolio = await Portfolio.findById(req.params.id);

    if (!portfolio) {
      return res.status(404).json({ success: false, message: 'Portfolio item not found' });
    }

    res.status(200).json({
      success: true,
      data: portfolio,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create new portfolio item
// @route   POST /api/portfolio
// @access  Private/Admin
const createPortfolioItem = async (req, res) => {
  try {
    const { displayOrder } = req.body;
    
    // Check if displayOrder already exists
    const duplicate = await Portfolio.findOne({ displayOrder });
    if (duplicate) {
      return res.status(400).json({ 
        success: false, 
        message: `Display Order ${displayOrder} is already assigned to "${duplicate.title}". Please choose a unique display order.` 
      });
    }

    const portfolio = await Portfolio.create(req.body);

    res.status(201).json({
      success: true,
      data: portfolio,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Update portfolio item
// @route   PUT /api/portfolio/:id
// @access  Private/Admin
const updatePortfolioItem = async (req, res) => {
  try {
    const { displayOrder } = req.body;
    
    // Check if displayOrder already exists for another portfolio item
    if (displayOrder !== undefined) {
      const duplicate = await Portfolio.findOne({ 
        displayOrder, 
        _id: { $ne: req.params.id } 
      });
      if (duplicate) {
        return res.status(400).json({ 
          success: false, 
          message: `Display Order ${displayOrder} is already assigned to "${duplicate.title}". Please choose a unique display order.` 
        });
      }
    }

    const portfolio = await Portfolio.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!portfolio) {
      return res.status(404).json({ success: false, message: 'Portfolio item not found' });
    }

    res.status(200).json({
      success: true,
      data: portfolio,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Delete portfolio item
// @route   DELETE /api/portfolio/:id
// @access  Private/Admin
const deletePortfolioItem = async (req, res) => {
  try {
    const portfolio = await Portfolio.findByIdAndDelete(req.params.id);

    if (!portfolio) {
      return res.status(404).json({ success: false, message: 'Portfolio item not found' });
    }

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Seed function to initialize data if empty
const seedPortfolioData = async () => {
  try {
    const count = await Portfolio.countDocuments();
    if (count === 0) {
      console.log('Seeding initial portfolio data...');
      const initialData = [
        {
          title: 'Multifarious Group',
          clientUrl: 'https://multifariousgroup.com/',
          category: 'development',
          tagline: 'High-Fidelity Corporate Infrastructure',
          description: 'A multi-faceted business conglomerate requiring a highly prestigious digital footprint. We designed and developed a blazing-fast corporate portal representing their extensive range of services with responsive layout, custom graphics, and fluid performance across viewports.',
          tags: ['Web Engineering', 'UI/UX Design', 'Corporate Branding', 'React & Vite'],
          image: 'https://vedhunt.in/wp-content/uploads/2026/01/multifarious-1.webp',
          statLabel: 'Lighthouse Score',
          statValue: '98/100',
          icon: 'Laptop',
          displayOrder: 1
        },
        {
          title: 'RINNSAMADHAN',
          clientUrl: 'https://rinnsamadhan.com/',
          category: 'automation',
          tagline: 'Secure Compliance & Bookkeeping Systems',
          description: 'A premium financial advisory and legal compliance portal. We integrated secure, multi-tier databases, professional outsourced accounting modules, automated document generators, and high-level executive analytics dashboards that streamline daily client-manager collaboration.',
          tags: ['Financial Tech', 'SQL Automation', 'Data Modeling', 'Client Portal'],
          image: 'https://vedhunt.in/wp-content/uploads/2026/01/rinn3.webp',
          statLabel: 'Lead Velocity',
          statValue: '+220%',
          icon: 'Database',
          displayOrder: 2
        },
        {
          title: 'Visionsfinity Shipping',
          clientUrl: 'https://visionsfinityshipping.com/',
          category: 'development',
          tagline: 'Global Freight & Logistic Visualizers',
          description: 'A global logistics, freight forwarding, and international shipping provider. We engineered their responsive digital platform incorporating real-time booking engines, shipping tracking visualizers, and highly refined, lag-free scrolling animations.',
          tags: ['Logistics App', 'React Router', 'UX Engineering', 'Global API Sync'],
          image: 'https://vedhunt.in/wp-content/uploads/2026/01/vision3.webp',
          statLabel: 'Efficiency',
          statValue: '3.5x Faster',
          icon: 'Laptop',
          displayOrder: 3
        },
        {
          title: 'Mumbai Shoppers',
          clientUrl: 'https://mumbaishopper.in/',
          category: 'marketing',
          tagline: 'High-Yield E-Commerce Scale & Paid Ads',
          description: 'A vibrant modern retail and fashion storefront. We developed an incredibly fast, highly intuitive online checkout grid and managed high-performance PPC advertising campaigns across Meta, Instagram, and Google that significantly multiplied purchase intent and organic search traffic.',
          tags: ['E-Commerce', 'Paid PPC Ads', 'SEO Dominance', 'Social Management'],
          image: 'https://vedhunt.in/wp-content/uploads/2026/01/mumbai3.webp',
          statLabel: 'Social Growth',
          statValue: '+310%',
          icon: 'Share2',
          displayOrder: 4
        }
      ];
      await Portfolio.insertMany(initialData);
      console.log('Portfolio data seeded successfully!');
    }
  } catch (error) {
    console.error('Error seeding portfolio data:', error);
  }
};

// @desc    Get all active portfolio metrics for public display
// @route   GET /api/portfolio/metrics
// @access  Public
const getPortfolioMetrics = async (req, res) => {
  try {
    const metrics = await PortfolioMetric.find({ isActive: true }).sort({ order: 1 });
    res.status(200).json({
      success: true,
      count: metrics.length,
      data: metrics
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all portfolio metrics for Admin
// @route   GET /api/portfolio/admin/metrics
// @access  Private/Admin
const getAdminPortfolioMetrics = async (req, res) => {
  try {
    const metrics = await PortfolioMetric.find().sort({ order: 1 });
    res.status(200).json({
      success: true,
      count: metrics.length,
      data: metrics
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a new portfolio metric
// @route   POST /api/portfolio/admin/metrics
// @access  Private/Admin
const createPortfolioMetric = async (req, res) => {
  try {
    const count = await PortfolioMetric.countDocuments();
    const order = req.body.order !== undefined ? req.body.order : count + 1;
    const metric = await PortfolioMetric.create({ 
      ...req.body, 
      order, 
      updatedBy: req.user._id 
    });
    res.status(201).json({
      success: true,
      data: metric
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Update a portfolio metric
// @route   PUT /api/portfolio/admin/metrics/:id
// @access  Private/Admin
const updatePortfolioMetric = async (req, res) => {
  try {
    const metric = await PortfolioMetric.findByIdAndUpdate(
      req.params.id, 
      { ...req.body, updatedBy: req.user._id }, 
      { new: true, runValidators: true }
    );
    if (!metric) {
      return res.status(404).json({ success: false, message: 'Metric not found' });
    }
    res.status(200).json({
      success: true,
      data: metric
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Delete a portfolio metric
// @route   DELETE /api/portfolio/admin/metrics/:id
// @access  Private/Admin
const deletePortfolioMetric = async (req, res) => {
  try {
    const metric = await PortfolioMetric.findByIdAndDelete(req.params.id);
    if (!metric) {
      return res.status(404).json({ success: false, message: 'Metric not found' });
    }
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Seed function for portfolio metrics
const seedPortfolioMetrics = async () => {
  try {
    const count = await PortfolioMetric.countDocuments();
    if (count === 0) {
      console.log('Seeding initial portfolio metrics data...');
      const initialMetrics = [
        { numericValue: 140, suffix: '+', label: 'Deployments Delivered', desc: 'Secure web systems and custom automation modules.', icon: 'Zap', order: 1 },
        { numericValue: 99, suffix: '%', label: 'Retention Rate', desc: 'SMEs & enterprises continuing partnerships with us.', icon: 'Award', order: 2 },
        { numericValue: 300, suffix: '%+', label: 'Engagement Growth', desc: 'Average increase across client marketing funnels.', icon: 'Share2', order: 3 },
        { numericValue: 15, suffix: ' Hrs', label: 'Saved per Week', desc: 'Through automated SQL and Power BI workflows.', icon: 'Database', order: 4 }
      ];
      await PortfolioMetric.insertMany(initialMetrics);
      console.log('Portfolio metrics data seeded successfully!');
    }
  } catch (error) {
    console.error('Error seeding portfolio metrics:', error);
  }
};

// @desc    Get the portfolio CTA section data
// @route   GET /api/portfolio/cta
// @access  Public
const getPortfolioCTA = async (req, res) => {
  try {
    let cta = await PortfolioCTA.findOne();
    if (!cta) {
      await seedPortfolioCTA();
      cta = await PortfolioCTA.findOne();
    }
    res.status(200).json({ success: true, data: cta });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update the portfolio CTA section data
// @route   PUT /api/portfolio/admin/cta
// @access  Private/Admin
const updatePortfolioCTA = async (req, res) => {
  try {
    let cta = await PortfolioCTA.findOne();
    if (!cta) {
      cta = await PortfolioCTA.create({ ...req.body, updatedBy: req.user._id });
    } else {
      cta = await PortfolioCTA.findOneAndUpdate(
        {},
        { ...req.body, updatedBy: req.user._id },
        { new: true, runValidators: true }
      );
    }
    res.status(200).json({ success: true, data: cta });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Seed function for portfolio CTA
const seedPortfolioCTA = async () => {
  try {
    const count = await PortfolioCTA.countDocuments();
    if (count === 0) {
      console.log('Seeding initial portfolio CTA data...');
      await PortfolioCTA.create({
        tagText: "Let's Collaborate",
        tagIcon: 'Sparkles',
        headingRegular: 'Ready to Build Your',
        headingHighlight: 'Digital Legacy?',
        buttonText: 'Start a Project',
        buttonLink: '/get-quote',
        features: [
          { text: 'Free Visual Mockup Draft', icon: 'Sparkles' },
          { text: 'Direct Engineering Channel', icon: 'Laptop' },
          { text: 'High-Performance Launch', icon: 'Zap' }
        ]
      });
      console.log('Portfolio CTA data seeded successfully!');
    }
  } catch (error) {
    console.error('Error seeding portfolio CTA data:', error);
  }
};

// @desc    Get the portfolio Hero section data
// @route   GET /api/portfolio/hero
// @access  Public
const getPortfolioHero = async (req, res) => {
  try {
    let hero = await PortfolioHero.findOne();
    if (!hero) {
      await seedPortfolioHero();
      hero = await PortfolioHero.findOne();
    }
    res.status(200).json({ success: true, data: hero });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update the portfolio Hero section data
// @route   PUT /api/portfolio/admin/hero
// @access  Private/Admin
const updatePortfolioHero = async (req, res) => {
  try {
    let hero = await PortfolioHero.findOne();
    if (!hero) {
      hero = await PortfolioHero.create({ ...req.body, updatedBy: req.user._id });
    } else {
      hero = await PortfolioHero.findOneAndUpdate(
        {},
        { ...req.body, updatedBy: req.user._id },
        { new: true, runValidators: true }
      );
    }
    res.status(200).json({ success: true, data: hero });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Seed function for portfolio Hero
const seedPortfolioHero = async () => {
  try {
    const count = await PortfolioHero.countDocuments();
    if (count === 0) {
      console.log('Seeding initial portfolio Hero data...');
      await PortfolioHero.create({
        subtitle: 'Success Showcases',
        headingRegular: 'Proven Engineering Standards',
        headingHighlight: '& Strategic Growth',
        description: 'Explore our real-world portfolio of partnerships across India. From full-scale corporate web architectures and automated bookkeeping tools, to organic SEO domination and high-converting marketing pipelines.'
      });
      console.log('Portfolio Hero data seeded successfully!');
    }
  } catch (error) {
    console.error('Error seeding portfolio Hero data:', error);
  }
};

module.exports = {
  getPortfolioItems,
  getAllAdminPortfolioItems,
  getPortfolioItem,
  createPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  seedPortfolioData,
  getPortfolioMetrics,
  getAdminPortfolioMetrics,
  createPortfolioMetric,
  updatePortfolioMetric,
  deletePortfolioMetric,
  seedPortfolioMetrics,
  getPortfolioCTA,
  updatePortfolioCTA,
  seedPortfolioCTA,
  getPortfolioHero,
  updatePortfolioHero,
  seedPortfolioHero
};
