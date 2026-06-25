const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

async function main() {
  const SQL = await initSqlJs();
  const possiblePaths = [
    'C:/Users/reyche/AppData/Roaming/Write Your Thoughts/write-your-thoughts.db',
  ];
  let dbFile = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      dbFile = p;
      break;
    }
  }

  if (!dbFile) {
    console.log('DB not found');
    return;
  }

  const filebuffer = fs.readFileSync(dbFile);
  const db = new SQL.Database(filebuffer);

  const res = db.exec('SELECT version_number, created_at FROM chapter_versions ORDER BY version_number DESC LIMIT 5');
  console.log(JSON.stringify(res, null, 2));
}
main();
