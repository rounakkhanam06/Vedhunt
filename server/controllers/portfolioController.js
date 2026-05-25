const Portfolio = require('../models/Portfolio');

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

module.exports = {
  getPortfolioItems,
  getAllAdminPortfolioItems,
  getPortfolioItem,
  createPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  seedPortfolioData
};
