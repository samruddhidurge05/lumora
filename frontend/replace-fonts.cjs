const fs = require('fs');
const files = [
  'c:\\Users\\vaiza\\Pictures\\Screenshots\\Vaiza aff\\lumora\\frontend\\src\\pages\\support\\About.jsx',
  'c:\\Users\\vaiza\\Pictures\\Screenshots\\Vaiza aff\\lumora\\frontend\\src\\pages\\support\\PrivacyPolicy.jsx'
];
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/font-family:\s*'Playfair Display',\s*Georgia,\s*serif;/g, "font-family: 'Outfit', sans-serif;");
  fs.writeFileSync(file, content);
}
console.log('done');
