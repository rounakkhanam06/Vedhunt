const https = require('https');
https.get('https://www.youtube.com/watch?v=hb6CFtZnj2c', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const match = data.match(/"lengthSeconds":"(\d+)"/);
    if(match) {
        const seconds = parseInt(match[1]);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        console.log(mins + ':' + secs.toString().padStart(2, '0'));
    } else {
        const metaMatch = data.match(/<meta itemprop="duration" content="PT(\d+M\d+S)">/);
        console.log('Meta:', metaMatch);
    }
  });
}).on('error', (err) => {
  console.log('Error: ', err.message);
});
