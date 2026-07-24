const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('ecommerce.db');

db.serialize(() => {
  db.each('SELECT id, title, affiliate_enabled FROM products', (err, row) => {
    if (err) console.error(err);
    console.log(`Product: ${row.id} - ${row.title} - AffiliateEnabled: ${row.affiliate_enabled}`);
  });
});

db.close();
