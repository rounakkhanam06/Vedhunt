const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const PresenceLocation = require('../models/PresenceLocation');

// Accurate percentage coordinates for india.svg map container
// These are calibrated for a standard India SVG where the map is rendered
// with object-contain inside a square aspect-ratio container.
const LOCATIONS = [
  { name: 'Indore',   top: '52%',  left: '36%',  delay: 0   },
  { name: 'Mumbai',   top: '62%',  left: '27%',  delay: 0.2 },
  { name: 'Kolkata',  top: '50%',  left: '70%',  delay: 0.4 },
  { name: 'Nagpur',   top: '54%',  left: '46%',  delay: 0.6 },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Remove existing locations so we start fresh
    await PresenceLocation.deleteMany({});
    console.log('Cleared existing presence locations');

    // Insert the 4 cities
    const created = await PresenceLocation.insertMany(LOCATIONS);
    console.log(`Seeded ${created.length} presence locations:`);
    created.forEach(loc => console.log(`  ✓ ${loc.name} (top: ${loc.top}, left: ${loc.left})`));

    await mongoose.disconnect();
    console.log('Done. Disconnected from MongoDB.');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

seed();
