import fs from 'fs';

const data = JSON.parse(fs.readFileSync('server/demo_data.json', 'utf-8'));
console.log('Total units in demo_data.json:', data.MOCK_UNITS.length);
data.MOCK_UNITS.forEach(u => {
  console.log(`ID: ${u.id}, Code: "${u.code}", Brand: "${u.brand}", Model: "${u.model}", Status: "${u.status}", BranchId: ${u.branchId}`);
});
