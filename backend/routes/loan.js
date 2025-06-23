const express = require('express');
const LoanApplication = require('../models/LoanApplication');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/loan/applications
// @desc    Create a new loan application
// @access  Private
router.post('/applications', protect, async (req, res) => {
  try {
    const {
      loanType,
      amount,
      term,
      purpose,
      personalInfo,
      employmentInfo,
      financialInfo
    } = req.body;

    // Validate required fields
    if (!loanType || !amount || !term || !purpose) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide loan type, amount, term, and purpose'
      });
    }

    const application = await LoanApplication.create({
      userId: req.user._id,
      loanType,
      amount,
      term,
      purpose,
      personalInfo,
      employmentInfo,
      financialInfo
    });

    res.status(201).json({
      status: 'success',
      data: application
    });
  } catch (error) {
    console.error('Create loan application error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while creating loan application'
    });
  }
});

// @route   GET /api/loan/applications
// @desc    Get all loan applications for user
// @access  Private
router.get('/applications', protect, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const query = { userId: req.user._id };
    if (status) {
      query.status = status;
    }

    const applications = await LoanApplication.find(query)
      .select('-personalInfo.ssn')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await LoanApplication.countDocuments(query);

    res.json({
      status: 'success',
      data: {
        applications,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        totalApplications: count
      }
    });
  } catch (error) {
    console.error('Get loan applications error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching loan applications'
    });
  }
});

// @route   GET /api/loan/applications/:id
// @desc    Get specific loan application
// @access  Private
router.get('/applications/:id', protect, async (req, res) => {
  try {
    const application = await LoanApplication.findOne({
      _id: req.params.id,
      userId: req.user._id
    }).select('-personalInfo.ssn');

    if (!application) {
      return res.status(404).json({
        status: 'error',
        message: 'Loan application not found'
      });
    }

    res.json({
      status: 'success',
      data: application
    });
  } catch (error) {
    console.error('Get loan application error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching loan application'
    });
  }
});

// @route   PUT /api/loan/applications/:id
// @desc    Update loan application
// @access  Private
router.put('/applications/:id', protect, async (req, res) => {
  try {
    const {
      loanType,
      amount,
      term,
      purpose,
      personalInfo,
      employmentInfo,
      financialInfo
    } = req.body;

    const application = await LoanApplication.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!application) {
      return res.status(404).json({
        status: 'error',
        message: 'Loan application not found'
      });
    }

    // Only allow updates if status is draft
    if (application.status !== 'draft') {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot update application that is not in draft status'
      });
    }

    // Update fields
    if (loanType) application.loanType = loanType;
    if (amount) application.amount = amount;
    if (term) application.term = term;
    if (purpose) application.purpose = purpose;
    if (personalInfo) application.personalInfo = { ...application.personalInfo, ...personalInfo };
    if (employmentInfo) application.employmentInfo = { ...application.employmentInfo, ...employmentInfo };
    if (financialInfo) application.financialInfo = { ...application.financialInfo, ...financialInfo };

    await application.save();

    res.json({
      status: 'success',
      data: application
    });
  } catch (error) {
    console.error('Update loan application error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while updating loan application'
    });
  }
});

// @route   POST /api/loan/applications/:id/submit
// @desc    Submit loan application
// @access  Private
router.post('/applications/:id/submit', protect, async (req, res) => {
  try {
    const application = await LoanApplication.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!application) {
      return res.status(404).json({
        status: 'error',
        message: 'Loan application not found'
      });
    }

    if (application.status !== 'draft') {
      return res.status(400).json({
        status: 'error',
        message: 'Application is already submitted or processed'
      });
    }

    // Validate required information
    if (!application.personalInfo.firstName || !application.personalInfo.lastName) {
      return res.status(400).json({
        status: 'error',
        message: 'Please complete personal information before submitting'
      });
    }

    application.status = 'submitted';
    await application.save();

    res.json({
      status: 'success',
      message: 'Loan application submitted successfully',
      data: application
    });
  } catch (error) {
    console.error('Submit loan application error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while submitting loan application'
    });
  }
});

// @route   POST /api/loan/applications/:id/documents
// @desc    Upload documents for loan application
// @access  Private
router.post('/applications/:id/documents', protect, async (req, res) => {
  try {
    const { documentType, filename, url } = req.body;

    const application = await LoanApplication.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!application) {
      return res.status(404).json({
        status: 'error',
        message: 'Loan application not found'
      });
    }

    application.documents.push({
      type: documentType,
      filename,
      url
    });

    await application.save();

    res.json({
      status: 'success',
      message: 'Document uploaded successfully',
      data: application.documents[application.documents.length - 1]
    });
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while uploading document'
    });
  }
});

// Admin routes
// @route   GET /api/loan/admin/applications
// @desc    Get all loan applications (admin only)
// @access  Private/Admin
router.get('/admin/applications', protect, authorize('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const query = {};
    if (status) {
      query.status = status;
    }

    const applications = await LoanApplication.find(query)
      .populate('userId', 'name email')
      .select('-personalInfo.ssn')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await LoanApplication.countDocuments(query);

    res.json({
      status: 'success',
      data: {
        applications,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        totalApplications: count
      }
    });
  } catch (error) {
    console.error('Admin get applications error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching applications'
    });
  }
});

// @route   PUT /api/loan/admin/applications/:id/status
// @desc    Update loan application status (admin only)
// @access  Private/Admin
router.put('/admin/applications/:id/status', protect, authorize('admin'), async (req, res) => {
  try {
    const { status, approvalDetails, rejectionDetails } = req.body;

    const application = await LoanApplication.findById(req.params.id);

    if (!application) {
      return res.status(404).json({
        status: 'error',
        message: 'Loan application not found'
      });
    }

    application.status = status;

    if (status === 'approved' && approvalDetails) {
      application.approvalDetails = {
        ...approvalDetails,
        approvedBy: req.user._id,
        approvedAt: new Date()
      };
    }

    if (status === 'rejected' && rejectionDetails) {
      application.rejectionDetails = {
        ...rejectionDetails,
        rejectedBy: req.user._id,
        rejectedAt: new Date()
      };
    }

    await application.save();

    res.json({
      status: 'success',
      message: 'Application status updated successfully',
      data: application
    });
  } catch (error) {
    console.error('Admin update status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while updating application status'
    });
  }
});

module.exports = router; 