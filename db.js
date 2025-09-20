// db.js
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const defaultPath = './data/employees.db';                    // local dev
const dbFile = process.env.DB_FILE || defaultPath;
const dir = path.dirname(dbFile);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(dbFile);

// Create table if not exists
db.exec(`
CREATE TABLE IF NOT EXISTS Employees (
  UserId       INTEGER PRIMARY KEY AUTOINCREMENT,
  FirstName    TEXT NOT NULL,
  LastName     TEXT NOT NULL,
  EmployeeType TEXT NOT NULL,          -- e.g., FullTime, Intern, Contractor
  Email        TEXT NOT NULL UNIQUE,
  BeginDate    TEXT NOT NULL,          -- ISO date string YYYY-MM-DD
  JobTitle     TEXT NOT NULL,
  Manager      TEXT                    -- Manager name or UserId reference (string for simplicity)
);
`);

function seed() {
  const already = db.prepare('SELECT COUNT(*) AS c FROM Employees').get().c;
  if (already > 0) return;

  const insert = db.prepare(`
    INSERT INTO Employees
    (FirstName, LastName, EmployeeType, Email, BeginDate, JobTitle, Manager)
    VALUES (@FirstName, @LastName, @EmployeeType, @Email, @BeginDate, @JobTitle, @Manager)
  `);

  const seedData = [
    {
      FirstName: 'Asha',
      LastName: 'Verma',
      EmployeeType: 'FullTime',
      Email: 'asha.verma@example.com',
      BeginDate: '2024-01-10',
      JobTitle: 'Software Engineer',
      Manager: 'Ravi Kumar'
    },
    {
      FirstName: 'Ravi',
      LastName: 'Kumar',
      EmployeeType: 'FullTime',
      Email: 'ravi.kumar@example.com',
      BeginDate: '2022-09-01',
      JobTitle: 'Engineering Manager',
      Manager: null
    },
    {
      FirstName: 'Meera',
      LastName: 'Iyer',
      EmployeeType: 'Contractor',
      Email: 'meera.iyer@example.com',
      BeginDate: '2025-06-01',
      JobTitle: 'UX Designer',
      Manager: 'Ravi Kumar'
    }
  ];

  const tx = db.transaction((rows) => {
    rows.forEach((row) => insert.run(row));
  });

  tx(seedData);
}

if (process.argv.includes('--reset')) {
  if (fs.existsSync('./employees.db')) fs.unlinkSync('./employees.db');
  console.log('Database removed.');
  process.exit(0);
}

// Seed only if empty
seed();

export default db;
