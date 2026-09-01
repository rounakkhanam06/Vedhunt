const axios = require('axios');
require('dotenv').config();

const runTest = async () => {
  try {
    // 1. Login
    console.log('Logging in...');
    const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'vedhunt@gmail.com',
      password: 'password123' // Or whatever default password they use, wait, I don't know the password!
    });
    const token = loginRes.data.token;
    console.log('Logged in, token received');

  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
};

runTest();
