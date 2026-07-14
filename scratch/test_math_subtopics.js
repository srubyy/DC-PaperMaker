import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log("Starting Math Subtopics E2E Validation...");
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER PAGE ERROR:', err.message));
  
  // Set download behavior
  const downloadPath = path.join(__dirname, 'downloads');
  if (!fs.existsSync(downloadPath)) {
    fs.mkdirSync(downloadPath);
  }
  const client = await page.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloadPath
  });

  console.log("Navigating to http://localhost:3080...");
  await page.goto('http://localhost:3080');

  // Verify page title
  const title = await page.title();
  console.log(`Page title loaded: ${title}`);

  // Take initial screenshot
  await page.screenshot({ path: path.join(__dirname, 'initial_state.png') });
  console.log("Saved initial_state.png screenshot");

  // Click Register Button
  console.log("Clicking 'Register' button...");
  await page.waitForSelector('#show-register-btn', { timeout: 10000 });
  await page.evaluate(() => document.getElementById('show-register-btn').click());
  await new Promise(resolve => setTimeout(resolve, 500));

  // Fill Register Form
  console.log("Filling register form...");
  await page.type('#register-name', 'E2E Test User');
  const testEmail = `e2e_${Date.now()}@example.com`;
  await page.type('#register-email', testEmail);
  await page.type('#register-password', 'Password123!');
  await page.type('#register-confirm-password', 'Password123!');
  
  // Accept terms
  await page.evaluate(() => document.getElementById('register-terms').click());
  await new Promise(resolve => setTimeout(resolve, 500));

  // Click Submit
  console.log("Submitting registration...");
  await page.evaluate(() => document.getElementById('register-submit-btn').click());

  // Wait for success toast
  console.log("Waiting for registration success toast...");
  await page.waitForSelector('.toast.toast-success', { timeout: 10000 });
  console.log("Registration successful!");
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Select subject 'Mathematics'
  console.log("Selecting subject: Mathematics...");
  await page.select('#subject-select', 'Mathematics');

  // Wait 1 second for topics metadata to load and select to appear
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Take screenshot after subject select
  await page.screenshot({ path: path.join(__dirname, 'after_subject_select.png') });
  console.log("Saved after_subject_select.png screenshot");

  // Check if subtopics checkbox for E1.8 exists and check it
  const e18CheckboxId = 'chk-E1_8__Standard_form';
  const checkboxExists = await page.evaluate((id) => {
    return !!document.getElementById(id);
  }, e18CheckboxId);
  console.log(`Does Standard Form checkbox exist: ${checkboxExists}`);

  if (checkboxExists) {
    // Click checkbox
    await page.evaluate((id) => document.getElementById(id).click(), e18CheckboxId);
    console.log("Checked 'E1.8: Standard form' checkbox");

    // Set count to 2
    await page.evaluate(() => {
      const qty = document.getElementById('qty-E1_8__Standard_form');
      qty.value = 2;
      // Trigger input event to recalculate
      qty.dispatchEvent(new Event('input', { bubbles: true }));
    });
    console.log("Set quantity to 2");

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 500));

    // Get current total marks display
    const totalMarks = await page.evaluate(() => {
      return document.getElementById('total-marks-display').textContent;
    });
    console.log(`Total Marks displayed: ${totalMarks}`);

    // Take screenshot after selecting subtopic
    await page.screenshot({ path: path.join(__dirname, 'after_selection.png') });
    console.log("Saved after_selection.png screenshot");

    // Click generate button
    console.log("Clicking 'Generate Paired PDFs'...");
    await page.evaluate(() => document.getElementById('generate-btn').click());

    // Wait for the success toast (up to 30 seconds)
    console.log("Waiting for generation to finish...");
    await page.waitForSelector('.toast.toast-success', { timeout: 30000 });

    const toastText = await page.evaluate(() => {
      const el = document.querySelector('.toast.toast-success .toast-message');
      return el ? el.textContent : '';
    });
    console.log(`Success Toast message: ${toastText}`);
    
    // Screenshot at completion
    await page.screenshot({ path: path.join(__dirname, 'completion.png') });
    console.log("Saved completion.png screenshot");

    console.log("E2E MATH SUBTOPICS TEST PASSED SUCCESSFULLY! 🚀");
  } else {
    console.log("❌ Test FAILED: Checkbox not found.");
  }

  await browser.close();
}

main().catch(console.error);
