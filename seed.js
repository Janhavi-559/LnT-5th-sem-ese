/**
 * Database Seeder Script
 * Fills database with realistic mock data for Christ University CIA-3 Evaluation
 * Run via: npm run seed
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Book = require('./models/Book');
const Transaction = require('./models/Transaction');
const Hold = require('./models/Hold');
const FinePayment = require('./models/FinePayment');
const OverdueNotification = require('./models/OverdueNotification');
const { connectDB, disconnectDB } = require('./config/db');
const {
  ROLES,
  MEMBER_TYPES,
  TRANSACTION_STATUS,
  FINE_STATUS,
  HOLD_STATUS,
  NOTIFICATION_STATUS,
  PAYMENT_METHODS
} = require('./config/constants');

const seedData = async () => {
  try {
    await connectDB();
    console.log('[Seeder] Resetting existing collections...');

    await Promise.all([
      User.deleteMany({}),
      Book.deleteMany({}),
      Transaction.deleteMany({}),
      Hold.deleteMany({}),
      FinePayment.deleteMany({}),
      OverdueNotification.deleteMany({})
    ]);

    console.log('[Seeder] Creating University Users (Admin, Librarians, Students, Faculty)...');

    // 1. Seed Users
    const users = await User.create([
      {
        name: 'Chief Administrator',
        email: 'admin@library.edu',
        passwordHash: 'Admin@123',
        membershipId: 'ADM-2026-0001',
        role: ROLES.ADMIN,
        department: 'Library Directorate',
        phone: '+91 9876543210'
      },
      {
        name: 'Sarah Jenkins',
        email: 'sarah.librarian@library.edu',
        passwordHash: 'Lib@12345',
        membershipId: 'LIB-2026-0001',
        role: ROLES.LIBRARIAN,
        department: 'Circulation Section',
        phone: '+91 9876543211'
      },
      {
        name: 'John Doe',
        email: 'john.librarian@library.edu',
        passwordHash: 'Lib@12345',
        membershipId: 'LIB-2026-0002',
        role: ROLES.LIBRARIAN,
        department: 'Reference Section',
        phone: '+91 9876543212'
      },
      {
        name: 'Alex Rivera',
        email: 'alex.student@christ.in',
        passwordHash: 'Student@123',
        membershipId: 'MEM-2026-0001',
        role: ROLES.MEMBER,
        memberType: MEMBER_TYPES.STUDENT,
        maxBooksAllowed: 3,
        loanPeriodDays: 14,
        department: 'Computer Science',
        phone: '+91 9876543220'
      },
      {
        name: 'Priya Sharma',
        email: 'priya.student@christ.in',
        passwordHash: 'Student@123',
        membershipId: 'MEM-2026-0002',
        role: ROLES.MEMBER,
        memberType: MEMBER_TYPES.STUDENT,
        maxBooksAllowed: 3,
        loanPeriodDays: 14,
        department: 'Data Science',
        phone: '+91 9876543221'
      },
      {
        name: 'Rahul Verma',
        email: 'rahul.student@christ.in',
        passwordHash: 'Student@123',
        membershipId: 'MEM-2026-0003',
        role: ROLES.MEMBER,
        memberType: MEMBER_TYPES.STUDENT,
        maxBooksAllowed: 3,
        loanPeriodDays: 14,
        department: 'Information Technology',
        phone: '+91 9876543222'
      },
      {
        name: 'Dr. Anand Kumar',
        email: 'dr.anand@christ.in',
        passwordHash: 'Faculty@123',
        membershipId: 'MEM-2026-0004',
        role: ROLES.MEMBER,
        memberType: MEMBER_TYPES.FACULTY,
        maxBooksAllowed: 8,
        loanPeriodDays: 30,
        department: 'Computer Science & Engineering',
        phone: '+91 9876543230'
      },
      {
        name: 'Prof. Anita Rao',
        email: 'prof.anita@christ.in',
        passwordHash: 'Faculty@123',
        membershipId: 'MEM-2026-0005',
        role: ROLES.MEMBER,
        memberType: MEMBER_TYPES.FACULTY,
        maxBooksAllowed: 8,
        loanPeriodDays: 30,
        department: 'School of Business Studies',
        phone: '+91 9876543231'
      }
    ]);

    const [admin, librarian1, , alex, priya, rahul, drAnand] = users;

    console.log('[Seeder] Creating Curated Book Catalog across disciplines...');

    // 2. Seed Books
    const books = await Book.create([
      {
        title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
        author: 'Robert C. Martin',
        isbn: '978-0132350884',
        category: 'Software Engineering',
        totalCopies: 5,
        availableCopies: 3,
        rackNumber: 'SE-R1-04',
        edition: '1st Edition',
        publisher: 'Prentice Hall',
        publishedYear: 2008,
        price: 650,
        description: 'Even bad code can function. But if code isn’t clean, it can bring a development organization to its knees.'
      },
      {
        title: 'Introduction to Algorithms (CLRS)',
        author: 'Thomas H. Cormen, Charles E. Leiserson, Ronald L. Rivest, Clifford Stein',
        isbn: '978-0262033848',
        category: 'Computer Science',
        totalCopies: 4,
        availableCopies: 1,
        rackNumber: 'CS-R2-12',
        edition: '3rd Edition',
        publisher: 'MIT Press',
        publishedYear: 2009,
        price: 1200,
        description: 'A comprehensive textbook covering modern algorithms, complexity analysis, and data structures.'
      },
      {
        title: 'Artificial Intelligence: A Modern Approach',
        author: 'Stuart Russell, Peter Norvig',
        isbn: '978-0136042594',
        category: 'Artificial Intelligence',
        totalCopies: 3,
        availableCopies: 0, // Out of stock to test Hold Queue
        rackNumber: 'AI-R3-01',
        edition: '4th Edition',
        publisher: 'Pearson',
        publishedYear: 2020,
        price: 1450,
        description: 'The authoritative, comprehensive introduction to the theory and practice of artificial intelligence.'
      },
      {
        title: 'Design Patterns: Elements of Reusable Object-Oriented Software',
        author: 'Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides',
        isbn: '978-0201633610',
        category: 'Software Engineering',
        totalCopies: 4,
        availableCopies: 4,
        rackNumber: 'SE-R1-08',
        edition: '1st Edition',
        publisher: 'Addison-Wesley',
        publishedYear: 1994,
        price: 750,
        description: 'Captures a wealth of experience about the design of object-oriented software.'
      },
      {
        title: 'Node.js Design Patterns',
        author: 'Mario Casciaro, Luciano Mammino',
        isbn: '978-1839214110',
        category: 'Web Development',
        totalCopies: 3,
        availableCopies: 2,
        rackNumber: 'WD-R4-03',
        edition: '3rd Edition',
        publisher: 'Packt Publishing',
        publishedYear: 2020,
        price: 850,
        description: 'Master the design and implementation of asynchronous architectures using Node.js.'
      },
      {
        title: 'Database System Concepts',
        author: 'Abraham Silberschatz, Henry F. Korth, S. Sudarshan',
        isbn: '978-0078022159',
        category: 'Database Systems',
        totalCopies: 6,
        availableCopies: 5,
        rackNumber: 'DB-R2-05',
        edition: '7th Edition',
        publisher: 'McGraw-Hill',
        publishedYear: 2019,
        price: 980,
        description: 'Presents the fundamental concepts of database management in an intuitive manner.'
      },
      {
        title: 'Deep Learning',
        author: 'Ian Goodfellow, Yoshua Bengio, Aaron Courville',
        isbn: '978-0262035613',
        category: 'Artificial Intelligence',
        totalCopies: 2,
        availableCopies: 1,
        rackNumber: 'AI-R3-04',
        edition: '1st Edition',
        publisher: 'MIT Press',
        publishedYear: 2016,
        price: 1300,
        description: 'An introduction to a broad range of topics in deep learning.'
      }
    ]);

    const [cleanCode, clrs, aiBook, , nodePatterns] = books;

    console.log('[Seeder] Creating Realistic Issue/Return Transactions & Overdue records...');

    const now = new Date();
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const twentyFiveDaysAgo = new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 3. Transactions
    // 3.1 Active on-time loan
    await Transaction.create({
      bookId: cleanCode._id,
      memberId: alex._id,
      issueDate: tenDaysAgo,
      dueDate: new Date(tenDaysAgo.getTime() + 14 * 24 * 60 * 60 * 1000), // Due in 4 days
      status: TRANSACTION_STATUS.ISSUED,
      fineAmount: 0,
      fineStatus: FINE_STATUS.NONE,
      issuedBy: librarian1._id
    });

    // 3.2 Active OVERDUE loan (Due 11 days ago -> Overdue fine demonstration!)
    const overdueDueDate = new Date(twentyFiveDaysAgo.getTime() + 14 * 24 * 60 * 60 * 1000);
    const daysOverdue = Math.ceil((now.getTime() - overdueDueDate.getTime()) / (1000 * 60 * 60 * 24));
    const overdueFine = daysOverdue * 10; // Student fine rate

    const overdueTx = await Transaction.create({
      bookId: clrs._id,
      memberId: priya._id,
      issueDate: twentyFiveDaysAgo,
      dueDate: overdueDueDate,
      status: TRANSACTION_STATUS.ISSUED,
      fineAmount: overdueFine,
      fineStatus: FINE_STATUS.UNPAID,
      remarks: `Overdue loan demonstration. Overdue by ${daysOverdue} days.`,
      issuedBy: librarian1._id
    });

    // 3.3 Active loan by Faculty
    await Transaction.create({
      bookId: nodePatterns._id,
      memberId: drAnand._id,
      issueDate: tenDaysAgo,
      dueDate: new Date(tenDaysAgo.getTime() + 30 * 24 * 60 * 60 * 1000),
      status: TRANSACTION_STATUS.ISSUED,
      fineAmount: 0,
      fineStatus: FINE_STATUS.NONE,
      issuedBy: librarian1._id
    });

    // 3.4 Completed return with fine paid
    const returnedTx = await Transaction.create({
      bookId: cleanCode._id,
      memberId: rahul._id,
      issueDate: thirtyDaysAgo,
      dueDate: new Date(thirtyDaysAgo.getTime() + 14 * 24 * 60 * 60 * 1000),
      returnDate: new Date(thirtyDaysAgo.getTime() + 18 * 24 * 60 * 60 * 1000), // 4 days late
      fineAmount: 40,
      fineStatus: FINE_STATUS.PAID,
      status: TRANSACTION_STATUS.RETURNED,
      remarks: 'Returned 4 days late. Fine paid at reception.',
      issuedBy: librarian1._id,
      returnedTo: librarian1._id
    });

    // 4. Seed Fine Payment receipt for returnedTx
    await FinePayment.create({
      transactionId: returnedTx._id,
      memberId: rahul._id,
      amount: 40,
      paymentMethod: PAYMENT_METHODS.UPI,
      receiptNumber: 'REC-2026-100192',
      collectedBy: librarian1._id,
      remarks: 'Fine for 4 days overdue on Clean Code',
      paidAt: returnedTx.returnDate
    });

    // 5. Seed Hold Queue for out-of-stock AI Book
    console.log('[Seeder] Creating Hold Queue on out-of-stock books...');
    await Hold.create({
      bookId: aiBook._id,
      memberId: alex._id,
      requestedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      status: HOLD_STATUS.QUEUED
    });

    await Hold.create({
      bookId: aiBook._id,
      memberId: rahul._id,
      requestedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      status: HOLD_STATUS.QUEUED
    });

    // 6. Seed Overdue Notification alert
    console.log('[Seeder] Creating Overdue Notification record for overdue transaction...');
    await OverdueNotification.create({
      memberId: priya._id,
      transactionId: overdueTx._id,
      bookId: clrs._id,
      daysOverdue,
      accruedFine: overdueFine,
      noticeDate: now,
      status: NOTIFICATION_STATUS.SENT,
      message: `Dear Priya Sharma, your borrowed book 'Introduction to Algorithms (CLRS)' is overdue by ${daysOverdue} days. Current fine: ₹${overdueFine}.`
    });

    console.log('\n=============================================================');
    console.log('  Database Seeding Completed Successfully!                   ');
    console.log('=============================================================');
    console.log('  Demo Credentials for Evaluation:                           ');
    console.log('  Role       Email                       Password            ');
    console.log('  ---------------------------------------------------------  ');
    console.log('  Admin:     admin@library.edu           Admin@123           ');
    console.log('  Librarian: sarah.librarian@library.edu Lib@12345           ');
    console.log('  Student:   alex.student@christ.in      Student@123         ');
    console.log('  Student:   priya.student@christ.in     Student@123 (Overdue)');
    console.log('  Faculty:   dr.anand@christ.in          Faculty@123         ');
    console.log('=============================================================\n');

    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error('[Seeder] Error populating database:', err);
    process.exit(1);
  }
};

seedData();
