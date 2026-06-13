const Agenda = require('agenda');

const agenda = new Agenda({
  db: {
    address: process.env.MONGODB_URI,
    collection: 'agendaJobs'
  },
  processEvery: '10 seconds'
});

// We will define jobs here later
require('./emailWorker')(agenda);

agenda.on('ready', async () => {
  console.log('Agenda started successfully');
  await agenda.start();
});

agenda.on('error', (err) => {
  console.error('Agenda connection error:', err);
});

// Graceful shutdown
const graceful = async () => {
  console.log('Stopping agenda...');
  await agenda.stop();
  process.exit(0);
};

process.on('SIGTERM', graceful);
process.on('SIGINT', graceful);

module.exports = agenda;
