require('dotenv').config();
const mongoose = require('mongoose');
const { seedFaqData } = require('./controllers/faqController');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('Connected to DB');
  await seedFaqData();
  console.log('Done seeding FAQs');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
