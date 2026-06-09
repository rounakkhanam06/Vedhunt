const mongoose = require('mongoose');
const slugify = require('slugify');
const HomePricingCard = require('./models/HomePricingCard');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
.then(async () => {
  const cards = await HomePricingCard.find();
  for (let card of cards) {
    if (!card.slug) {
      card.slug = slugify(card.title, { lower: true, strict: true });
    }
    card.showOnHome = true; // existing cards were shown on home
    await card.save();
  }
  console.log('Migration complete');
  process.exit();
}).catch(console.error);
