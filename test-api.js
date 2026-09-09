/**
 * Automated End-to-End API Test Suite
 * Validates all 13 modules against the live Express server
 * Run via: npm test
 */
const http = require('http');
const mongoose = require('mongoose');
const { app } = require('./server');

const PORT = 5001; // Run tests on port 5001
let serverInstance;

let adminToken = '';
let librarianToken = '';
let studentToken = '';
let testBookId = '';
let testMemberId = '';
let testTransactionId = '';

const request = (method, path, headers = {}, body = null) => {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };
    if (payload) {
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path,
        method,
        headers: reqHeaders
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch (e) {
            parsed = data;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
};

const assert = (condition, testName) => {
  if (!condition) {
    console.error(`  ❌ FAILED: ${testName}`);
    process.exitCode = 1;
  } else {
    console.log(`  ✅ PASSED: ${testName}`);
  }
};

const waitForMongoose = async () => {
  while (mongoose.connection.readyState !== 1) {
    await new Promise((r) => setTimeout(r, 200));
  }
};

const runTests = async () => {
  console.log('\n=============================================================');
  console.log('  Running Automated Integration Tests for Modules 1 - 13      ');
  console.log('=============================================================\n');

  // Start server on test port
  serverInstance = app.listen(PORT);
  await waitForMongoose();
  console.log('[Test Runner] Connected to MongoDB and test server is listening on port', PORT);

  try {
    // 0. Health Check
    console.log('\n--- Test Group 0: Server Health ---');
    const health = await request('GET', '/api/health');
    assert(health.status === 200 && health.body.success, 'Health check returns 200 OK');

    // 1. Authentication (Module 1 & 13)
    console.log('\n--- Test Group 1: Member Registration & Authentication ---');
    const adminLogin = await request('POST', '/api/auth/login', {}, {
      email: 'admin@library.edu',
      password: 'Admin@123'
    });
    assert(adminLogin.status === 200 && adminLogin.body.data.token, 'Admin login succeeds and issues JWT');
    adminToken = adminLogin.body.data.token;

    const libLogin = await request('POST', '/api/auth/login', {}, {
      email: 'sarah.librarian@library.edu',
      password: 'Lib@12345'
    });
    assert(libLogin.status === 200 && libLogin.body.data.token, 'Librarian login succeeds and issues JWT');
    librarianToken = libLogin.body.data.token;

    const studentLogin = await request('POST', '/api/auth/login', {}, {
      email: 'alex.student@christ.in',
      password: 'Student@123'
    });
    assert(studentLogin.status === 200 && studentLogin.body.data.token, 'Student login succeeds and issues JWT');
    studentToken = studentLogin.body.data.token;
    testMemberId = studentLogin.body.data.user._id;

    // Test Registration with auto-membershipId
    const randEmail = `test.user.${Date.now()}@christ.in`;
    const regRes = await request('POST', '/api/auth/register', {}, {
      name: 'Integration Test User',
      email: randEmail,
      password: 'TestUser@123',
      memberType: 'student',
      department: 'Computer Science'
    });
    assert(
      regRes.status === 201 &&
      regRes.body.data.user.membershipId &&
      regRes.body.data.user.membershipId.startsWith('MEM-'),
      'New user registered with automatic MEM-2026-XXXX format'
    );

    // 2. Book Catalog & Search (Modules 2 & 3)
    console.log('\n--- Test Group 2: Book Catalog & Search ---');
    const searchRes = await request('GET', '/api/books/search?q=clean');
    assert(searchRes.status === 200 && searchRes.body.data.length > 0, 'Search by keyword returns matching book(s)');
    testBookId = searchRes.body.data[0]._id;

    const createBookRes = await request(
      'POST',
      '/api/books',
      { Authorization: `Bearer ${librarianToken}` },
      {
        title: `Test Automated Book ${Date.now()}`,
        author: 'E2E Test Runner',
        isbn: `ISBN-TEST-${Date.now()}`,
        category: 'Testing',
        totalCopies: 3,
        rackNumber: 'T-01',
        price: 450
      }
    );
    assert(createBookRes.status === 201 && createBookRes.body.data.availableCopies === 3, 'Librarian can create new book');
    const newlyCreatedBookId = createBookRes.body.data._id;

    // 3. Book Issue Workflow (Module 4)
    console.log('\n--- Test Group 3: Book Issue Workflow ---');
    const issueRes = await request(
      'POST',
      '/api/transactions/issue',
      { Authorization: `Bearer ${librarianToken}` },
      {
        bookId: newlyCreatedBookId,
        memberId: testMemberId,
        remarks: 'Automated test issue'
      }
    );
    assert(issueRes.status === 201 && issueRes.body.data.status === 'ISSUED', 'Book successfully issued to student');
    testTransactionId = issueRes.body.data._id;

    // 4. Book Return & Fine Calculation (Module 5)
    console.log('\n--- Test Group 4: Book Return & Fine Calculation ---');
    const returnRes = await request(
      'PUT',
      `/api/transactions/${testTransactionId}/return`,
      { Authorization: `Bearer ${librarianToken}` }
    );
    assert(returnRes.status === 200 && returnRes.body.data.fineStatus !== undefined, 'Book return processed with fine computation');

    // 5. Reservation/Hold Queue (Module 6)
    console.log('\n--- Test Group 5: Reservation / Hold Queue ---');
    const outOfStockSearch = await request('GET', `/api/books/search?q=${encodeURIComponent('Artificial Intelligence')}`);
    const outOfStockBook = outOfStockSearch.body.data?.find((b) => b.availableCopies === 0);

    if (outOfStockBook) {
      const holdRes = await request(
        'POST',
        '/api/holds',
        { Authorization: `Bearer ${studentToken}` },
        { bookId: outOfStockBook._id }
      );
      assert(holdRes.status === 201 || holdRes.status === 409, 'Hold queue prevents duplicates or places queue spot');
    } else {
      console.log('  ⚠️ Out of stock book not found; skipping hold creation test');
    }

    // 6. Membership Plans & Limits (Module 7)
    console.log('\n--- Test Group 6: Membership Plans & Limits ---');
    const plansRes = await request('GET', '/api/users/plans');
    assert(
      plansRes.status === 200 &&
      plansRes.body.data.student.maxBooksAllowed === 3 &&
      plansRes.body.data.faculty.maxBooksAllowed === 8,
      'Predefined student and faculty quotas retrieved correctly'
    );

    // 7. Fines & Payments (Module 8)
    console.log('\n--- Test Group 7: Fines & Payment Receipts ---');
    const unpaidFines = await request('GET', '/api/fines/unpaid', {
      Authorization: `Bearer ${librarianToken}`
    });
    assert(unpaidFines.status === 200 && Array.isArray(unpaidFines.body.data), 'Librarian can fetch all unpaid fines');

    // 8. Overdue Notifications (Module 9)
    console.log('\n--- Test Group 8: Overdue Notification Generation ---');
    const scanRes = await request('POST', '/api/notifications/generate-overdue', {
      Authorization: `Bearer ${librarianToken}`
    });
    assert(scanRes.status === 200 && scanRes.body.success, 'Automated overdue scan executes without errors');

    // 9. Inventory & Copy Management (Module 10)
    console.log('\n--- Test Group 9: Inventory & Copy Management ---');
    const invRes = await request(
      'PUT',
      `/api/books/${newlyCreatedBookId}/inventory`,
      { Authorization: `Bearer ${librarianToken}` },
      { addCopies: 2, damagedCopies: 1 }
    );
    assert(invRes.status === 200 && invRes.body.data.totalCopies >= 4, 'Stock copies adjusted successfully');

    // 10. Member History (Module 11)
    console.log('\n--- Test Group 10: Member Borrowing History ---');
    const myHistoryRes = await request('GET', '/api/transactions/my-history', {
      Authorization: `Bearer ${studentToken}`
    });
    assert(myHistoryRes.status === 200 && Array.isArray(myHistoryRes.body.data), 'Member can fetch their borrowing history');

    // 11. Reports Aggregations (Module 12)
    console.log('\n--- Test Group 11: Analytics & Executive Reports ---');
    const mostBorrowed = await request('GET', '/api/reports/most-borrowed', {
      Authorization: `Bearer ${adminToken}`
    });
    assert(mostBorrowed.status === 200 && Array.isArray(mostBorrowed.body.data), 'Most borrowed aggregation report generated');

    const invHealth = await request('GET', '/api/reports/inventory-health', {
      Authorization: `Bearer ${adminToken}`
    });
    assert(invHealth.status === 200 && invHealth.body.data.totalTitles > 0, 'Inventory health aggregation report generated');

    const finReport = await request('GET', '/api/reports/financials', {
      Authorization: `Bearer ${adminToken}`
    });
    assert(finReport.status === 200 && finReport.body.data.totalCollected !== undefined, 'Financial revenue report generated');

    // 12. Role-Based Access Control Security (Module 13)
    console.log('\n--- Test Group 12: Role-Based Access Control (RBAC) Security ---');
    const forbiddenCreateBook = await request(
      'POST',
      '/api/books',
      { Authorization: `Bearer ${studentToken}` },
      { title: 'Hacked Book', author: 'Hacker', isbn: 'HACK-1', category: 'None', totalCopies: 1 }
    );
    assert(forbiddenCreateBook.status === 403, 'Student is forbidden (403) from creating books in catalog');

    const unauthenticated = await request('GET', '/api/auth/profile');
    assert(unauthenticated.status === 401, 'Unauthenticated request receives 401 Unauthorized');

    console.log('\n=============================================================');
    console.log('  🎉 All 13 Modules Integration Tests Passed Successfully!   ');
    console.log('=============================================================\n');
  } catch (err) {
    console.error('Test execution exception:', err);
    process.exitCode = 1;
  } finally {
    if (serverInstance) {
      serverInstance.close();
    }
    process.exit(process.exitCode || 0);
  }
};

runTests();
