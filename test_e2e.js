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
    console.log("Navigating to http://localhost:3080...");
    await page.goto('http://localhost:3080', { waitUntil: 'networkidle0' });

    // 1. Verify page title
    const title = await page.title();
    console.log("Page title loaded:", title);
    if (!title.includes("Direction Classes")) {
      throw new Error("Page title mismatch");
    }

    // 2. Select Chemistry from dropdown
    console.log("Selecting subject: Chemistry...");
    await page.waitForSelector('#subject-select');
    await page.select('#subject-select', 'Chemistry');

    // Wait for dynamic topics list to render
    console.log("Waiting for topics list to render...");
    await page.waitForSelector('#chk-Chemical_Bonding');
    console.log("Topics loaded successfully.");

    // 3. Select Chemical Bonding and request 2 questions
    console.log("Selecting 'Chemical Bonding' checkbox...");
    await page.click('#chk-Chemical_Bonding');
    
    console.log("Setting 'Chemical Bonding' count to 2...");
    await page.evaluate(() => {
      const input = document.querySelector('#qty-Chemical_Bonding');
      input.value = '2';
      input.dispatchEvent(new Event('input'));
    });

    // Verify marks total is 7
    let marks = await page.$eval('#total-marks-display', el => el.textContent);
    console.log(`Current Total Marks display: ${marks}`);
    if (marks !== '7') {
      throw new Error(`Expected total marks to be 7, but got ${marks}`);
    }
    console.log("✔ Marks calculation verified: 7 Marks");

    // 4. Test Over-limit Validation: Select Organic Chemistry and set count to 4 (only 3 exist in DB)
    console.log("Selecting 'Organic Chemistry' checkbox...");
    await page.click('#chk-Organic_Chemistry');
    
    console.log("Setting 'Organic Chemistry' count to 4 (exceeding availability)...");
    await page.evaluate(() => {
      const input = document.querySelector('#qty-Organic_Chemistry');
      input.value = '4';
      input.dispatchEvent(new Event('input'));
    });

    // Check error display
    const isErrorVisible = await page.$eval('#validation-error-box', el => !el.classList.contains('hidden'));
    const errorMessage = await page.$eval('#error-message-text', el => el.textContent);
    const isBtnDisabled = await page.$eval('#generate-btn', el => el.disabled);
    
    console.log(`Error visible: ${isErrorVisible}`);
    console.log(`Error message displayed: "${errorMessage}"`);
    console.log(`Generate button disabled: ${isBtnDisabled}`);

    if (!isErrorVisible || !isBtnDisabled || !errorMessage.includes("requested 4 questions, but only 3 available")) {
      throw new Error("Validation check failed: error box not showing or button is not disabled");
    }
    console.log("✔ Over-limit validation verified (Error displayed and generation blocked)");

    // 5. Restore valid quantity: Set Organic Chemistry to 2
    console.log("Restoring 'Organic Chemistry' count to 2 (valid)...");
    await page.evaluate(() => {
      const input = document.querySelector('#qty-Organic_Chemistry');
      input.value = '2';
      input.dispatchEvent(new Event('input'));
    });

    const isErrorHidden = await page.$eval('#validation-error-box', el => el.classList.contains('hidden'));
    const isBtnEnabled = await page.$eval('#generate-btn', el => !el.disabled);
    marks = await page.$eval('#total-marks-display', el => el.textContent);
    
    console.log(`Error hidden: ${isErrorHidden}`);
    console.log(`Generate button enabled: ${isBtnEnabled}`);
    console.log(`New Total Marks: ${marks}`); // CHEM-CB-0001 (5) + CHEM-CB-0002 (2) + CHEM-OC-0001 (4) + CHEM-OC-0002 (5) = 16 marks

    if (!isErrorHidden || !isBtnEnabled || marks !== '16') {
      throw new Error("Error states not cleared or marks miscalculated after adjustment");
    }
    console.log("✔ Safe quantity adjustment verified: 16 Marks");

    // 6. Test Generation Request
    console.log("Clicking 'Generate Paired PDFs' button...");
    await page.evaluate(() => document.getElementById('generate-btn').click());
    
    console.log("Waiting for successful toast notification...");
    await page.waitForSelector('.toast-success', { timeout: 15000 });
    const toastText = await page.$eval('.toast-success', el => el.textContent);
    console.log("Success Toast text:", toastText.trim());
    
    if (!toastText.includes("downloaded successfully")) {
      throw new Error("Generation failure toast message");
    }
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
