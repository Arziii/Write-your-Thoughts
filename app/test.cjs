const initSqlJs = require('sql.js');
const fs = require('fs');

const dbText = fs.readFileSync('C:/Users/reyche/AppData/Roaming/write-your-thoughts/database/write-your-thoughts.db');

initSqlJs().then(SQL => {
  const db = new SQL.Database(dbText);
  const id = db.exec('SELECT id FROM books LIMIT 1')[0].values[0][0];
  console.log('Book ID:', id);

  const coverImage = 'base64test';
  const now = 'now';
  const updates = ['updated_at = ?', 'synced = 0'];
  const params = [now];
  updates.push('cover_image = ?');
  params.push(coverImage);
  params.push(id);

  const sql = 'UPDATE books SET ' + updates.join(', ') + ' WHERE id = ?';
  console.log('SQL:', sql);
  console.log('Params:', params);

  db.run(sql, params);

  const res = db.exec("SELECT cover_image FROM books WHERE id = '" + id + "'");
  console.log('Result:', JSON.stringify(res));
});
