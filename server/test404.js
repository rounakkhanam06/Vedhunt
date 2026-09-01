const mongoose = require('mongoose');
const Admin = require('./models/Admin');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const runTest = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const admin = await Admin.findOne({ email: 'vedhunt@gmail.com' });
    const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    console.log('Testing DELETE /api/leads/');
    try {
      const response = await fetch('http://localhost:5000/api/leads/', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const text = await response.text();
      console.log('Status:', response.status);
      console.log('Content-Type:', response.headers.get('content-type'));
      console.log('Response:', text.substring(0, 100));
    } catch (e) {
      console.error(e);
    }

    console.log('\nTesting DELETE /api/leads/undefined');
    try {
      const response = await fetch('http://localhost:5000/api/leads/undefined', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const text = await response.text();
      console.log('Status:', response.status);
      console.log('Content-Type:', response.headers.get('content-type'));
      console.log('Response:', text);
    } catch (e) {
      console.error(e);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

runTest();
