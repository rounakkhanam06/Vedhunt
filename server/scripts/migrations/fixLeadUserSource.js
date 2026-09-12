const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

async function fixUserSources() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');
    
    // 1. Update Facebook leads where userSource is Direct or missing
    const fbRes = await mongoose.connection.db.collection('leads').updateMany(
      { platform: 'Facebook', $or: [{ userSource: 'Direct' }, { userSource: { $exists: false } }, { userSource: null }] },
      { $set: { userSource: 'Facebook' } }
    );
    console.log(`Updated Facebook leads: ${fbRes.modifiedCount}`);

    // 2. Update Instagram leads where userSource is Direct or missing
    const igRes = await mongoose.connection.db.collection('leads').updateMany(
      { platform: 'Instagram', $or: [{ userSource: 'Direct' }, { userSource: { $exists: false } }, { userSource: null }] },
      { $set: { userSource: 'Instagram' } }
    );
    console.log(`Updated Instagram leads: ${igRes.modifiedCount}`);

    // 3. Update Google Search leads where source indicates Google
    const gRes = await mongoose.connection.db.collection('leads').updateMany(
      { source: /google/i, $or: [{ userSource: 'Direct' }, { userSource: { $exists: false } }, { userSource: null }] },
      { $set: { userSource: 'Google' } }
    );
    console.log(`Updated Google leads: ${gRes.modifiedCount}`);

    console.log('Migration complete!');
    process.exit(0);
  } catch (err) {
    console.error('Error updating userSources:', err);
    process.exit(1);
  }
}

fixUserSources();
