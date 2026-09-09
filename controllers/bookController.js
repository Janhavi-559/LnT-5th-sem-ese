const Book = require('../models/Book');
const Transaction = require('../models/Transaction');
const Hold = require('../models/Hold');
const ApiError = require('../utils/apiError');
const { TRANSACTION_STATUS, HOLD_STATUS } = require('../config/constants');

/**
 * @desc   Create a new book record (Module 2: Book Catalog Management)
 * @route  POST /api/books
 * @access Librarian, Admin
 */
const createBook = async (req, res, next) => {
  try {
    const {
      title,
      author,
      isbn,
      category,
      totalCopies,
      rackNumber,
      edition,
      publisher,
      publishedYear,
      price,
      description
    } = req.body;

    const existingBook = await Book.findOne({ isbn: isbn.toUpperCase().trim() });
    if (existingBook) {
      throw new ApiError(`Book with ISBN ${isbn} already exists in the catalog`, 409, 'ISBN_ALREADY_EXISTS');
    }

    const copies = parseInt(totalCopies, 10) || 1;

    const book = await Book.create({
      title,
      author,
      isbn: isbn.toUpperCase().trim(),
      category,
      totalCopies: copies,
      availableCopies: copies,
      rackNumber: rackNumber || 'General Shelf',
      edition,
      publisher,
      publishedYear,
      price: price || 500,
      description
    });

    res.status(201).json({
      success: true,
      message: 'Book created successfully in catalog',
      data: book
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Get all books with filtering and pagination
 * @route  GET /api/books
 * @access Public / Authenticated
 */
const getAllBooks = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.category) {
      filter.category = { $regex: new RegExp(`^${req.query.category.trim()}$`, 'i') };
    }

    if (req.query.availableOnly === 'true') {
      filter.availableCopies = { $gt: 0 };
    }

    const total = await Book.countDocuments(filter);
    const books = await Book.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // List of unique categories for frontend filters
    const categories = await Book.distinct('category');

    res.status(200).json({
      success: true,
      count: books.length,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      },
      categories,
      data: books
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Search & filter catalog (Module 3: Catalog Search & Filtering)
 * @route  GET /api/books/search
 * @access Public / Authenticated
 */
const searchBooks = async (req, res, next) => {
  try {
    const { q, title, author, category, isbn, availableOnly, page = 1, limit = 10 } = req.query;

    const parsedPage = parseInt(page, 10) || 1;
    const parsedLimit = parseInt(limit, 10) || 10;
    const skip = (parsedPage - 1) * parsedLimit;

    const query = {};

    // General keyword search across title, author, category, ISBN
    if (q && q.trim() !== '') {
      const regex = new RegExp(q.trim(), 'i');
      query.$or = [
        { title: regex },
        { author: regex },
        { category: regex },
        { isbn: regex }
      ];
    } else {
      if (title) query.title = new RegExp(title.trim(), 'i');
      if (author) query.author = new RegExp(author.trim(), 'i');
      if (category) query.category = new RegExp(category.trim(), 'i');
      if (isbn) query.isbn = new RegExp(isbn.trim(), 'i');
    }

    if (availableOnly === 'true') {
      query.availableCopies = { $gt: 0 };
    }

    const total = await Book.countDocuments(query);
    const books = await Book.find(query)
      .sort({ availableCopies: -1, title: 1 })
      .skip(skip)
      .limit(parsedLimit);

    res.status(200).json({
      success: true,
      count: books.length,
      pagination: {
        total,
        page: parsedPage,
        pages: Math.ceil(total / parsedLimit),
        limit: parsedLimit
      },
      data: books
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Get single book details including hold queue count
 * @route  GET /api/books/:id
 * @access Public / Authenticated
 */
const getBookById = async (req, res, next) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      throw new ApiError('Book record not found', 404, 'BOOK_NOT_FOUND');
    }

    const activeHoldsCount = await Hold.countDocuments({
      bookId: book._id,
      status: HOLD_STATUS.QUEUED
    });

    const activeIssuedCount = await Transaction.countDocuments({
      bookId: book._id,
      status: TRANSACTION_STATUS.ISSUED
    });

    res.status(200).json({
      success: true,
      data: {
        ...book.toObject(),
        activeHoldsCount,
        activeIssuedCount
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Update book details
 * @route  PUT /api/books/:id
 * @access Librarian, Admin
 */
const updateBook = async (req, res, next) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      throw new ApiError('Book record not found', 404, 'BOOK_NOT_FOUND');
    }

    // Check if new ISBN conflicts with another book
    if (req.body.isbn && req.body.isbn.toUpperCase() !== book.isbn) {
      const conflict = await Book.findOne({ isbn: req.body.isbn.toUpperCase() });
      if (conflict) {
        throw new ApiError('Another book with this ISBN already exists', 409, 'ISBN_CONFLICT');
      }
    }

    const updatedBook = await Book.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Book updated successfully',
      data: updatedBook
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Delete a book from catalog
 * @route  DELETE /api/books/:id
 * @access Librarian, Admin
 */
const deleteBook = async (req, res, next) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      throw new ApiError('Book record not found', 404, 'BOOK_NOT_FOUND');
    }

    // Ensure no active loan transactions exist
    const activeLoans = await Transaction.countDocuments({
      bookId: book._id,
      status: TRANSACTION_STATUS.ISSUED
    });

    if (activeLoans > 0) {
      throw new ApiError(
        `Cannot delete book. There are currently ${activeLoans} active issued copies.`,
        400,
        'ACTIVE_TRANSACTIONS_EXIST'
      );
    }

    await Book.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Book successfully deleted from catalog'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc   Adjust inventory copies (Module 10: Inventory & Copy Management)
 * @route  PUT /api/books/:id/inventory
 * @access Librarian, Admin
 */
const updateInventory = async (req, res, next) => {
  try {
    const { addCopies, lostCopies, damagedCopies } = req.body;
    const book = await Book.findById(req.params.id);

    if (!book) {
      throw new ApiError('Book not found', 404, 'BOOK_NOT_FOUND');
    }

    if (addCopies !== undefined) {
      const added = parseInt(addCopies, 10);
      book.totalCopies += added;
      book.availableCopies += added;
    }

    if (lostCopies !== undefined) {
      const lostDelta = parseInt(lostCopies, 10);
      book.lostCopies += lostDelta;
      book.totalCopies = Math.max(0, book.totalCopies - lostDelta);
      book.availableCopies = Math.max(0, book.availableCopies - lostDelta);
    }

    if (damagedCopies !== undefined) {
      const damDelta = parseInt(damagedCopies, 10);
      book.damagedCopies += damDelta;
      book.availableCopies = Math.max(0, book.availableCopies - damDelta);
    }

    await book.save();

    res.status(200).json({
      success: true,
      message: 'Inventory copy counts updated successfully',
      data: book
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createBook,
  getAllBooks,
  searchBooks,
  getBookById,
  updateBook,
  deleteBook,
  updateInventory
};
