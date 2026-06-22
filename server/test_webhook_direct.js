const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const Lead = require('./models/Lead');

// Mock data fetched from Graph API
const mockGraphData = {
  id: 'mock_fb_lead_123456',
  field_data: [
    { name: 'full_name', values: ['José O\'Connor'] },
    { name: 'email', values: ['jose.oconnor@example.com'] },
    { name: 'phone_number', values: ['+91 98765-43210'] },
    { name: 'city', values: ['Delhi'] }
  ]
};

async function testDirect() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    const fbLeadId = 'mock_fb_lead_' + Date.now();
    const adId = '999999999';
    const formId = '888888888';

    // Verify if duplicate
    const existingLead = await Lead.findOne({ fbLeadId });
    if (existingLead) {
      console.log('Duplicate detected, skipping.');
      process.exit(0);
    }

    // Mapping fields exactly like the controller
    let fullName = 'Unknown';
    let email = '';
    let phone = 'Not provided';
    let city = '';
    let businessName = '';
    let service = `FB Form ${formId}`;

    mockGraphData.field_data.forEach(field => {
      const val = (field.values && field.values[0]) ? field.values[0].trim() : '';
      if (!val) return;

      switch(field.name) {
        case 'full_name': fullName = val; break;
        case 'email': email = val; break;
        case 'phone_number': phone = val; break;
        case 'city': city = val; break;
      }
    });

    // Sanitize
    fullName = fullName.trim() || 'Unknown';
    phone = phone.trim() || 'Not provided';
    
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || !emailRegex.test(email)) {
      email = `fb_${fbLeadId}@facebook.com`;
    }

    console.log('Creating lead with parameters:');
    console.log({ fullName, email, phone, city, fbLeadId });

    const lead = await Lead.create({
      fullName,
      email,
      phone,
      city,
      businessName,
      service,
      platform: 'Facebook',
      fbLeadId,
      adCampaignId: '666666666',
      source: `Facebook Lead Ad (Ad: ${adId})`,
      consent: true,
      utmSource: 'facebook',
      utmMedium: 'cpc',
      utmCampaign: '666666666'
    });

    console.log('SUCCESS! Lead created successfully:', lead.leadId);

    // Clean up test lead
    await Lead.deleteOne({ _id: lead._id });
    console.log('Test lead cleaned up successfully.');

  } catch (error) {
    console.error('TEST FAILED:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

testDirect();
