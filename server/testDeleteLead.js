const mongoose = require('mongoose');
const Admin = require('./models/Admin');
const Lead = require('./models/Lead');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const runTest = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    // 1. Get admin and generate token directly to bypass password requirement
    const admin = await Admin.findOne({ email: 'vedhunt@gmail.com' });
    if (!admin) throw new Error('Admin not found');
    
    const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // 2. Create a dummy lead directly in DB
    const dummyLead = await Lead.create({
      fullName: 'Test Delete Lead',
      phone: '1234567890',
      email: 'testdelete@example.com',
      service: 'Test',
      source: 'Test',
      consent: true,
      leadType: 'Sales'
    });
    console.log('Created dummy lead:', dummyLead._id);

    // 3. Attempt to delete it via API using native fetch
    console.log('Attempting to delete via API...');
    try {
      const response = await fetch(`http://localhost:5000/api/leads/${dummyLead._id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      console.log('API Status:', response.status);
      console.log('API Response:', data);
    } catch (apiError) {
      console.error('API Request Error:', apiError);
    }

    // Cleanup just in case
    await Lead.findByIdAndDelete(dummyLead._id);
    console.log('Cleanup done');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

runTest();
