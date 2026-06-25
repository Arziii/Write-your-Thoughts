const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config'), 'untold-stories', 'database.sqlite');
console.log('Connecting to DB at:', dbPath);

try {
  const db = new Database(dbPath);
  const result = db.prepare('DELETE FROM timeline_events').run();
  console.log(`Deleted ${result.changes} outdated timeline events.`);
  db.close();
} catch (err) {
  console.error('Error clearing timeline_events:', err);
}
