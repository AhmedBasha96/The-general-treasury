const http = require('http');

http.get('http://localhost:5000/api/dashboard', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('Dashboard summary:');
      console.log(json.summary);
    } catch(e) {
      console.log('Raw output:', data);
    }
  });
}).on('error', err => {
  console.log('Server query error:', err.message);
});
