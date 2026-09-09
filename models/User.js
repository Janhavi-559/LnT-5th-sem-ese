const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES, MEMBER_TYPES, DEFAULT_PLANS } = require('../config/constants');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
      select: false
    },
    membershipId: {
      type: String,
      unique: true,
      index: true
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.MEMBER
    },
    memberType: {
      type: String,
      enum: Object.values(MEMBER_TYPES),
      default: MEMBER_TYPES.STUDENT
    },
    maxBooksAllowed: {
      type: Number
    },
    loanPeriodDays: {
      type: Number
    },
    phone: {
      type: String,
      trim: true
    },
    department: {
      type: String,
      trim: true,
      default: 'General'
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Index for email is set by unique: true

// Pre-save hook: Hash password and set plan defaults
userSchema.pre('save', async function (next) {
  // If member limits aren't set, assign based on memberType
  if (this.role === ROLES.MEMBER) {
    const plan = DEFAULT_PLANS[this.memberType] || DEFAULT_PLANS[MEMBER_TYPES.STUDENT];
    if (this.maxBooksAllowed === undefined) {
      this.maxBooksAllowed = plan.maxBooksAllowed;
    }
    if (this.loanPeriodDays === undefined) {
      this.loanPeriodDays = plan.loanPeriodDays;
    }
  }

  // Hash password if modified
  if (!this.isModified('passwordHash')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Remove sensitive fields from JSON serialization
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
