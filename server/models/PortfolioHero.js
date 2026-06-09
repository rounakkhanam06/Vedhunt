const mongoose = require('mongoose');

const portfolioHeroSchema = new mongoose.Schema(
  {
    subtitle: {
      type: String,
      required: true,
      default: 'Success Showcases',
    },
    headingRegular: {
      type: String,
      required: true,
      default: 'Proven Engineering Standards',
    },
    headingHighlight: {
      type: String,
      required: true,
      default: '& Strategic Growth',
    },
    description: {
      type: String,
      required: true,
      default: 'Explore our real-world portfolio of partnerships across India. From full-scale corporate web architectures and automated bookkeeping tools, to organic SEO domination and high-converting marketing pipelines.',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('PortfolioHero', portfolioHeroSchema);
