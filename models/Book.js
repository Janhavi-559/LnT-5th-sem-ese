const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Book title is required'],
      trim: true
    },
    author: {
      type: String,
      required: [true, 'Author name is required'],
      trim: true
    },
    isbn: {
      type: String,
      required: [true, 'ISBN is required'],
      unique: true,
      trim: true,
      uppercase: true
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      index: true
    },
    totalCopies: {
      type: Number,
      required: [true, 'Total copies must be specified'],
      min: [1, 'Total copies must be at least 1']
    },
    availableCopies: {
      type: Number,
      required: [true, 'Available copies must be specified'],
      min: [0, 'Available copies cannot be negative']
    },
    lostCopies: {
      type: Number,
      default: 0,
      min: 0
    },
    damagedCopies: {
      type: Number,
      default: 0,
      min: 0
    },
    rackNumber: {
      type: String,
      default: 'General Shelf'
    },
    edition: {
      type: String,
      default: '1st Edition'
    },
    publisher: {
      type: String,
      default: 'Academic Press'
    },
    publishedYear: {
      type: Number
    },
    price: {
      type: Number,
      default: 500,
      min: 0
    },
    description: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes
bookSchema.index({ title: 1 });
bookSchema.index({ author: 1 });
// Compound text index for catalog search
bookSchema.index({ title: 'text', author: 'text', category: 'text', description: 'text' });

module.exports = mongoose.model('Book', bookSchema);
