const fs = require('fs');
const path = require('path');

const demoDataPath = path.join(__dirname, '..', 'server', 'demo_data.json');

if (!fs.existsSync(demoDataPath)) {
  console.log('No demo_data.json found. Exiting.');
  process.exit(0);
}

const data = JSON.parse(fs.readFileSync(demoDataPath, 'utf8'));

// 1. Añadir MOCK_BRANCHES y MOCK_USER_BRANCHES
if (!data.MOCK_BRANCHES) {
  data.MOCK_BRANCHES = [
    {
      id: 1,
      name: "Bodega Principal",
      address: "Sede Central",
      isMainWarehouse: 1,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
}

if (!data.MOCK_USER_BRANCHES) {
  data.MOCK_USER_BRANCHES = [];
  // Asignar los usuarios actuales a la bodega principal
  if (data.MOCK_USERS) {
    data.MOCK_USERS.forEach(user => {
      data.MOCK_USER_BRANCHES.push({
        id: data.MOCK_USER_BRANCHES.length + 1,
        userId: user.id,
        branchId: 1,
        isDefault: 1
      });
    });
  }
}

// 2. Añadir branchId: 1 a las tablas que lo necesitan
const tablesToUpdate = [
  'MOCK_INVENTORY',
  'MOCK_MOVEMENTS',
  'MOCK_ORDERS',
  'MOCK_OPERATIONAL_EXPENSES',
  'MOCK_FINANCIAL_TRANSACTIONS',
  'MOCK_CASH_CLOSURES',
  'MOCK_CASH_OPENINGS',
  'MOCK_SALES'
];

tablesToUpdate.forEach(tableName => {
  if (data[tableName]) {
    data[tableName].forEach(item => {
      if (item.branchId === undefined) {
        item.branchId = 1;
      }
    });
  }
});

// Guardar
fs.writeFileSync(demoDataPath, JSON.stringify(data, null, 2), 'utf8');
console.log('Migration completed successfully.');
