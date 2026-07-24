const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('test.db');

db.serialize(() => {
  db.run("UPDATE products SET affiliate_enabled = 1");
  console.log("Updated all products to affiliate_enabled = 1");
  
  db.each('SELECT id, title, affiliate_enabled FROM products', (err, row) => {
    if (err) console.error(err);
    console.log(`Product: ${row.id} - ${row.title} - AffiliateEnabled: ${row.affiliate_enabled}`);
  });
});

db.close();
