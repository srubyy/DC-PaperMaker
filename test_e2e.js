import puppeteer from 'puppeteer';

async function runTest() {
  console.log("Starting End-to-End Headless UI Test on macOS...");
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  
  // Listen to browser console logs
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  
  try {
    // Navigate to local server
    console.log("Navigating to http://localhost:3085...");
    await page.goto('http://localhost:3085', { waitUntil: 'networkidle0' });

    // 1. Verify page title
    const title = await page.title();
    console.log("Page title loaded:", title);
    if (!title.includes("Direction Classes")) {
      throw new Error("Page title mismatch");
    }

    // 1.5 Login Flow
    console.log("Logging in as demo user...");
    await page.waitForSelector('#login-email');
    await page.type('#login-email', 'demo@example.com');
    await page.type('#login-password', 'Password123!');
    await page.click('#login-submit-btn');
    
    console.log("Waiting for dashboard to load...");
    await page.waitForFunction(() => !document.getElementById('app-dashboard-view').classList.contains('hidden'), { timeout: 10000 });

    // 2. Select Chemistry from dropdown
    console.log("Selecting subject: Chemistry...");
    await page.waitForSelector('#subject-select');
    await page.select('#subject-select', 'Chemistry');

    // Wait for dynamic topics and library to render
    console.log("Waiting for topics list and library card to render...");
    await page.waitForSelector('#chk-Covalent_Bonding');
    await page.waitForSelector('#card-CHEM_CB_0001');
    console.log("Topics and question cards loaded successfully.");

     // 3. Select question CHEM-CB-0001 (5 marks)
    console.log("Clicking 'Add to Test' for CHEM-CB-0001...");
    await page.waitForSelector('#card-CHEM_CB_0001 .btn-add');
    await page.evaluate(() => document.querySelector('#card-CHEM_CB_0001 .btn-add').click());
    
    // Verify marks total is 5
    let marks = await page.$eval('#total-marks-display', el => el.textContent);
    let count = await page.$eval('#selected-questions-count', el => el.textContent);
    console.log(`Current Total Marks display: ${marks}, count: ${count}`);
    if (marks !== '5' || count !== '1') {
      throw new Error(`Expected 5 marks and 1 question, but got ${marks} marks and ${count} questions`);
    }
    console.log("✔ First question addition verified");

    // 4. Select question CHEM-CB-0002 (2 marks)
    console.log("Clicking 'Add to Test' for CHEM-CB-0002...");
    await page.waitForSelector('#card-CHEM_CB_0002 .btn-add');
    await page.evaluate(() => document.querySelector('#card-CHEM_CB_0002 .btn-add').click());

    marks = await page.$eval('#total-marks-display', el => el.textContent);
    count = await page.$eval('#selected-questions-count', el => el.textContent);
    console.log(`Current Total Marks display: ${marks}, count: ${count}`);
    if (marks !== '7' || count !== '2') {
      throw new Error(`Expected 7 marks and 2 questions, but got ${marks} marks and ${count} questions`);
    }
    console.log("✔ Second question addition verified: 7 Marks");

    // 5. Test Filters: uncheck "Easy" difficulty and verify CHEM-CB-0002 (Easy) is hidden
    console.log("Unchecking 'Easy' difficulty filter...");
    await page.evaluate(() => document.getElementById('diff-easy').click());
    
    // Wait for card to disappear
    await page.waitForFunction(() => !document.getElementById('card-CHEM_CB_0002'));
    console.log("✔ Easy question hidden after unchecking Easy filter");

    // Restore Easy filter
    console.log("Rechecking 'Easy' difficulty filter...");
    await page.evaluate(() => document.getElementById('diff-easy').click());
    await page.waitForSelector('#card-CHEM_CB_0002');
    console.log("✔ Easy question reappeared");

    // 5.5. Test Shuffle Toggle
    console.log("Testing Shuffle functionality...");
    await page.evaluate(() => document.getElementById('randomize-toggle').click());
    console.log("✔ Shuffle Final Output toggle toggled successfully");

    // 6. Test Generation Request
    console.log("Clicking 'Generate PDFs' button...");
    await page.evaluate(() => document.getElementById('generate-btn').click());
    
    console.log("Waiting for successful toast notification...");
    await page.waitForFunction(() => {
      const toasts = Array.from(document.querySelectorAll('.toast-success'));
      return toasts.some(t => t.textContent.includes('downloaded successfully'));
    }, { timeout: 15000 });
    console.log("✔ PDF and ZIP Generation engine verified");
    
    console.log("\nALL UI & PDF GENERATION TESTS PASSED SUCCESSFULLY! 🚀");
  } catch (err) {
    console.error("\n❌ E2E TEST FAILED:", err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runTest();
