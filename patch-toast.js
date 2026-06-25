const fs = require('fs');
const file = '/Users/asrafalommahin/tolet-pro/project/tolet-pro-frontend/src/components/HostDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "showToast(language === 'বাংলা' ? 'আপডেট ব্যর্থ হয়েছে!' : 'Failed to update property.');",
  "showToast((language === 'বাংলা' ? 'আপডেট ব্যর্থ হয়েছে: ' : 'Failed to update property: ') + (err.message || ''));"
);

fs.writeFileSync(file, content);
