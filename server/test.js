const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const serviceManager = require('./services/serviceManager');

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const { services, total } = await serviceManager.getAdminServices(1, 10, '');
    console.log("Success:", total);
  } catch(e) {
    console.error("FAILED:", e);
  }
  process.exit();
}
test();
