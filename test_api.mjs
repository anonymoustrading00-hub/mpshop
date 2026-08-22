import http from 'http';

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

const trpcLoginPayload = JSON.stringify({
  "0": { json: { username: "admin", password: "admin123" } }
});

const loginRes = await request({
  hostname: 'localhost', port: 3000,
  path: '/api/trpc/auth.loginTraditional?batch=1', method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(trpcLoginPayload)
  }
}, trpcLoginPayload);

const cookies = loginRes.headers['set-cookie'];
const sessionCookie = cookies ? cookies[0].split(';')[0] : '';

// Call units.list with null input (the exact request tRPC sends when no args are passed)
const unitsResObj = await request({
  hostname: 'localhost', port: 3000,
  path: '/api/trpc/units.list?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D',
  method: 'GET',
  headers: {
    'Cookie': sessionCookie,
    'Content-Type': 'application/json'
  }
}, null);

console.log('UNITS.LIST with null input Status:', unitsResObj.status);
console.log('UNITS.LIST Response:', JSON.stringify(JSON.parse(unitsResObj.body), null, 2));
