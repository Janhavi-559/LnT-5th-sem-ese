/**
 * System-wide Constants & Configurations
 * Digital Library Management System (P05)
 */

const ROLES = {
  MEMBER: 'member',
  LIBRARIAN: 'librarian',
  ADMIN: 'admin'
};

const MEMBER_TYPES = {
  STUDENT: 'student',
  FACULTY: 'faculty'
};

const TRANSACTION_STATUS = {
  ISSUED: 'ISSUED',
  RETURNED: 'RETURNED',
  LOST: 'LOST'
};

const FINE_STATUS = {
  NONE: 'NONE',
  UNPAID: 'UNPAID',
  PAID: 'PAID',
  WAIVED: 'WAIVED'
};

const HOLD_STATUS = {
  QUEUED: 'QUEUED',
  AVAILABLE_FOR_PICKUP: 'AVAILABLE_FOR_PICKUP',
  FULFILLED: 'FULFILLED',
  CANCELLED: 'CANCELLED'
};

const NOTIFICATION_STATUS = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  RESOLVED: 'RESOLVED'
};

const PAYMENT_METHODS = {
  CASH: 'CASH',
  UPI: 'UPI',
  CARD: 'CARD',
  ONLINE_MOCK: 'ONLINE_MOCK'
};

const DEFAULT_PLANS = {
  [MEMBER_TYPES.STUDENT]: {
    maxBooksAllowed: parseInt(process.env.STUDENT_MAX_BOOKS || '3', 10),
    loanPeriodDays: parseInt(process.env.STUDENT_LOAN_DAYS || '14', 10),
    fineRatePerDay: parseInt(process.env.FINE_RATE_PER_DAY || '10', 10)
  },
  [MEMBER_TYPES.FACULTY]: {
    maxBooksAllowed: parseInt(process.env.FACULTY_MAX_BOOKS || '8', 10),
    loanPeriodDays: parseInt(process.env.FACULTY_LOAN_DAYS || '30', 10),
    fineRatePerDay: parseInt(process.env.FINE_RATE_PER_DAY || '5', 10) // Concession for faculty
  }
};

module.exports = {
  ROLES,
  MEMBER_TYPES,
  TRANSACTION_STATUS,
  FINE_STATUS,
  HOLD_STATUS,
  NOTIFICATION_STATUS,
  PAYMENT_METHODS,
  DEFAULT_PLANS
};
