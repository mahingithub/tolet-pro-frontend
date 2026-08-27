const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('pageerror', err => {
    console.log('PAGE ERROR:\n' + err.stack);
    process.exit(1);
  });
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('CONSOLE ERROR:', msg.text());
    }
  });

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
  
  await browser.close();
  process.exit(0);
})();
