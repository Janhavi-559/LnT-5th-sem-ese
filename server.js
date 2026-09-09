const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const { connectDB } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const ApiError = require('./utils/apiError');

// Route Handlers
const authRoutes = require('./routes/authRoutes');
const bookRoutes = require('./routes/bookRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const holdRoutes = require('./routes/holdRoutes');
const fineRoutes = require('./routes/fineRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const reportRoutes = require('./routes/reportRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();

// Database Connection
connectDB();

// Global Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Serve Frontend Static Files
app.use(express.static(path.join(__dirname, 'public')));

// API Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'P05 Digital Library Management System API is running smoothly',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Mount Resource API Routes
app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/holds', holdRoutes);
app.use('/api/fines', fineRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);

// Handle 404 for undefined API endpoints
app.all('/api/*', (req, res, next) => {
  next(new ApiError(`Cannot find endpoint ${req.originalUrl} on this server`, 404, 'ROUTE_NOT_FOUND'));
});

// Fallback to frontend index.html for root or UI navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Centralized Error-Handling Middleware (Must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

let server;
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`  Digital Library Management System Server Online       `);
    console.log(`  URL: http://localhost:${PORT}                         `);
    console.log(`  Environment: ${process.env.NODE_ENV || 'development'} `);
    console.log(`=======================================================`);
  });
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error(`Unhandled Rejection: ${err.message}`);
  // Keep server alive in development
});

module.exports = { app, server };
