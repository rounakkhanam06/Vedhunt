require('dotenv').config();
const mongoose = require('mongoose');
const Job = require('./models/Job');

const OPEN_POSITIONS = [
  {
    title: 'Senior React & Next.js Architect',
    department: 'Engineering',
    location: 'Remote / Navi Mumbai',
    type: 'Full Time',
    experience: '4+ Years',
    description: 'Lead the architecture and development of scalable, high-performance web applications using React 19, Next.js, and modern state management ecosystems.',
    status: 'Published'
  },
  {
    title: 'UI/UX Designer & Design System Lead',
    department: 'Creative Design',
    location: 'Navi Mumbai',
    type: 'Full Time',
    experience: '3+ Years',
    description: 'Craft premium, high-converting visual layouts, micro-interactions, and maintain comprehensive design systems in Figma for enterprise clients.',
    status: 'Published'
  },
  {
    title: 'Senior Growth Marketer & PPC Specialist',
    department: 'Marketing',
    location: 'Remote / Navi Mumbai',
    type: 'Full Time',
    experience: '3+ Years',
    description: 'Scale client acquisition pipelines by managing high-budget Google Ads, Meta PPC, and LinkedIn ad campaigns with a focus on maximizing ROAS.',
    status: 'Published'
  },
  {
    title: 'Python Automation & Power BI Engineer',
    department: 'Data & BI',
    location: 'Navi Mumbai',
    type: 'Full Time',
    experience: '2+ Years',
    description: 'Build automated data extraction pipelines (ETL) and design advanced, interactive Power BI executive dashboards for international finance clients.',
    status: 'Published'
  }
];

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    
    // Check if jobs exist to prevent duplication
    const existingJobs = await Job.countDocuments();
    if (existingJobs > 0) {
      console.log('Jobs already exist in the database. Seeding skipped to prevent duplicates.');
      process.exit(0);
    }
    
    await Job.insertMany(OPEN_POSITIONS);
    console.log('Successfully seeded jobs!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
