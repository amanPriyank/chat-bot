const mongoose = require('mongoose');

const loanApplicationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  applicationNumber: {
    type: String,
    unique: true,
    required: true
  },
  loanType: {
    type: String,
    enum: ['personal', 'home', 'business', 'auto', 'student'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: [1000, 'Minimum loan amount is $1,000'],
    max: [1000000, 'Maximum loan amount is $1,000,000']
  },
  term: {
    type: Number,
    required: true,
    min: [1, 'Minimum term is 1 month'],
    max: [360, 'Maximum term is 360 months']
  },
  purpose: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'funded'],
    default: 'draft'
  },
  personalInfo: {
    firstName: String,
    lastName: String,
    dateOfBirth: Date,
    ssn: {
      type: String,
      select: false // Hide SSN by default
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String
    },
    phone: String,
    email: String
  },
  employmentInfo: {
    employer: String,
    jobTitle: String,
    income: Number,
    employmentLength: Number
  },
  financialInfo: {
    monthlyIncome: Number,
    monthlyExpenses: Number,
    creditScore: Number,
    existingDebts: Number
  },
  documents: [{
    type: {
      type: String,
      enum: ['id', 'paystub', 'bank_statement', 'tax_return', 'other']
    },
    filename: String,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  notes: [{
    content: String,
    author: {
      type: String,
      enum: ['user', 'assistant', 'admin']
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  approvalDetails: {
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    approvedAmount: Number,
    approvedTerm: Number,
    interestRate: Number,
    monthlyPayment: Number
  },
  rejectionDetails: {
    reason: String,
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rejectedAt: Date
  }
}, {
  timestamps: true
});

// Generate application number before saving
loanApplicationSchema.pre('save', function(next) {
  if (this.isNew && !this.applicationNumber) {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.applicationNumber = `LOAN-${timestamp}-${random}`;
  }
  next();
});

// Index for better query performance
loanApplicationSchema.index({ userId: 1, createdAt: -1 });
loanApplicationSchema.index({ applicationNumber: 1 });
loanApplicationSchema.index({ status: 1 });

module.exports = mongoose.model('LoanApplication', loanApplicationSchema); 