import http from 'http';
import superjson from 'superjson';

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// Superjson formatted login
const loginPayload = JSON.stringify({
  "0": superjson.serialize({ username: "admin", password: "admin123" })
});

const loginRes = await request({
  hostname: 'localhost', port: 3000,
  path: '/api/trpc/auth.loginTraditional?batch=1', method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(loginPayload)
  }
}, loginPayload);

const cookies = loginRes.headers['set-cookie'];
const sessionCookie = cookies ? cookies[0].split(';')[0] : '';

// Superjson formatted units.list query
const unitsInputParam = encodeURIComponent(JSON.stringify({
  "0": superjson.serialize({})
}));

const unitsRes = await request({
  hostname: 'localhost', port: 3000,
  path: `/api/trpc/units.list?batch=1&input=${unitsInputParam}`,
  method: 'GET',
  headers: {
    'Cookie': sessionCookie,
    'Content-Type': 'application/json'
  }
}, null);

console.log('UNITS.LIST with SuperJSON Status:', unitsRes.status);
console.log('UNITS.LIST Response:', unitsRes.body);
