const express = require('express');
const Chat = require('../models/Chat');
const { protect } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// @route   POST /api/chat/sessions
// @desc    Create a new chat session
// @access  Private
router.post('/sessions', protect, async (req, res) => {
  try {
    const { title } = req.body;

    const sessionId = uuidv4();
    const chat = await Chat.create({
      userId: req.user._id,
      sessionId,
      title: title || 'New Chat Session',
      messages: [{
        sender: 'assistant',
        content: 'Hello! I\'m your Fundobaba loan assistant. I\'m here to help you with quick pay-day loans backed by RBI-registered NBFC UY Fincorp. How can I assist you today? You can ask me about loan amounts, eligibility, application process, terms and conditions, or any other questions about our services.',
        messageType: 'text'
      }]
    });

    res.status(201).json({
      status: 'success',
      data: chat
    });
  } catch (error) {
    console.error('Create chat session error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while creating chat session'
    });
  }
});

// @route   GET /api/chat/sessions
// @desc    Get all chat sessions for user
// @access  Private
router.get('/sessions', protect, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const query = { userId: req.user._id };
    if (status) {
      query.status = status;
    }

    const chats = await Chat.find(query)
      .select('sessionId title status lastActivity createdAt messages')
      .sort({ lastActivity: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await Chat.countDocuments(query);

    res.json({
      status: 'success',
      data: {
        chats,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        totalChats: count
      }
    });
  } catch (error) {
    console.error('Get chat sessions error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching chat sessions'
    });
  }
});

// @route   GET /api/chat/sessions/:sessionId
// @desc    Get specific chat session with messages
// @access  Private
router.get('/sessions/:sessionId', protect, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const chat = await Chat.findOne({
      sessionId,
      userId: req.user._id
    });

    if (!chat) {
      return res.status(404).json({
        status: 'error',
        message: 'Chat session not found'
      });
    }

    res.json({
      status: 'success',
      data: chat
    });
  } catch (error) {
    console.error('Get chat session error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching chat session'
    });
  }
});

// @route   POST /api/chat/sessions/:sessionId/messages
// @desc    Send a message in a chat session
// @access  Private
router.post('/sessions/:sessionId/messages', protect, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { content, messageType = 'text' } = req.body;

    const chat = await Chat.findOne({
      sessionId,
      userId: req.user._id
    });

    if (!chat) {
      return res.status(404).json({
        status: 'error',
        message: 'Chat session not found'
      });
    }

    // Add user message
    chat.messages.push({
      sender: 'user',
      content,
      messageType
    });

    // Generate Fundobaba-specific assistant response
    const assistantResponse = await generateFundobabaResponse(content, chat.messages);
    
    chat.messages.push({
      sender: 'assistant',
      content: assistantResponse,
      messageType: 'text'
    });

    await chat.save();

    res.json({
      status: 'success',
      data: {
        userMessage: chat.messages[chat.messages.length - 2],
        assistantMessage: chat.messages[chat.messages.length - 1]
      }
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while sending message'
    });
  }
});

// @route   PUT /api/chat/sessions/:sessionId
// @desc    Update chat session (title, status, etc.)
// @access  Private
router.put('/sessions/:sessionId', protect, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { title, status, tags } = req.body;

    const chat = await Chat.findOne({
      sessionId,
      userId: req.user._id
    });

    if (!chat) {
      return res.status(404).json({
        status: 'error',
        message: 'Chat session not found'
      });
    }

    if (title) chat.title = title;
    if (status) chat.status = status;
    if (tags) chat.tags = tags;

    await chat.save();

    res.json({
      status: 'success',
      data: chat
    });
  } catch (error) {
    console.error('Update chat session error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while updating chat session'
    });
  }
});

// @route   DELETE /api/chat/sessions/:sessionId
// @desc    Delete a chat session
// @access  Private
router.delete('/sessions/:sessionId', protect, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const chat = await Chat.findOneAndDelete({
      sessionId,
      userId: req.user._id
    });

    if (!chat) {
      return res.status(404).json({
        status: 'error',
        message: 'Chat session not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Chat session deleted successfully'
    });
  } catch (error) {
    console.error('Delete chat session error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while deleting chat session'
    });
  }
});

// Enhanced Fundobaba-specific response generator with comprehensive training data
async function generateFundobabaResponse(userMessage, messageHistory) {
  const message = userMessage.toLowerCase();
  
  // Company structure and legal information
  if (message.includes('company') || message.includes('structure') || message.includes('legal') || message.includes('registration')) {
    return 'Fundobaba is a brand legally registered under U.Y. Fincorp Limited in joint venture with Fintech Cloud Private Limited. We are incorporated under the Companies Act, 2013 and operate as a digital lending platform. Our services are facilitated through partnerships with RBI-registered financial institutions and NBFCs.';
  }
  
  if (message.includes('u.y fincorp') || message.includes('uy fincorp') || message.includes('fincorp')) {
    return 'U.Y. Fincorp Limited is our parent company and the primary NBFC partner. We operate under their regulatory framework and they provide the financial backing for all our lending operations. This ensures compliance with RBI regulations and provides security for all transactions.';
  }
  
  if (message.includes('fintech cloud') || message.includes('joint venture')) {
    return 'Fundobaba operates as a joint venture between U.Y. Fincorp Limited and Fintech Cloud Private Limited. This partnership combines financial expertise with technological innovation to provide seamless digital lending solutions.';
  }
  
  // Terms and conditions
  if (message.includes('terms') || message.includes('conditions') || message.includes('agreement') || message.includes('legal')) {
    return 'Our terms and conditions constitute a legally binding agreement between you and Fundobaba. By using our services, you acknowledge that you have read, understood, and agree to be bound by these terms. The terms cover platform usage, data handling, loan agreements, and regulatory compliance. You can find the complete terms on our platform.';
  }
  
  if (message.includes('consent') || message.includes('authorization') || message.includes('permission')) {
    return 'By using our services, you provide informed and voluntary consent authorizing Fundobaba and our lending partners to access, store, use, and process your information for regulatory and operational purposes. This includes KYC verification, credit assessment, and loan processing.';
  }
  
  // Data handling and privacy
  if (message.includes('data') || message.includes('privacy') || message.includes('information') || message.includes('kyc')) {
    return 'We collect and process your personal and financial information including identity proof, contact details, salary slips, bank statements, PAN card, and other KYC documentation. This data is used for identity authentication, creditworthiness evaluation, and regulatory compliance. We follow RBI\'s KYC Master Directions and Prevention of Money Laundering Act, 2002.';
  }
  
  if (message.includes('tracking') || message.includes('location') || message.includes('monitoring')) {
    return 'We may track your location during and after service usage, including when the app is uninstalled, until all financial obligations are discharged. This is for security and regulatory compliance purposes. Discontinuation of platform usage does not absolve repayment responsibilities.';
  }
  
  if (message.includes('third party') || message.includes('api') || message.includes('external')) {
    return 'We use third-party APIs including Surepass, Novel Pattern, Credgenics, Ongrid, and GoCredit to enhance functionality and provide up-to-date information. These services help with KYC verification, credit assessment, and loan processing. Data from these sources is subject to their respective terms of service.';
  }
  
  // Communication and marketing
  if (message.includes('communication') || message.includes('contact') || message.includes('marketing') || message.includes('sms')) {
    return 'You consent to receive communications from Fundobaba, our representatives, affiliates, and lending partners via phone calls, SMS, or other modes. This includes transaction updates, promotional offers, and product information. You can opt out of marketing communications while still receiving important service-related messages.';
  }
  
  if (message.includes('opt out') || message.includes('unsubscribe') || message.includes('withdraw')) {
    return 'You have the right to withdraw consent for data collection and opt out of marketing communications at any time. You can do this by following unsubscribe links in our emails or contacting our support team. However, you may still receive important service-related communications.';
  }
  
  // Regulatory compliance
  if (message.includes('rbi') || message.includes('regulatory') || message.includes('compliance') || message.includes('fair practices')) {
    return 'We adhere to RBI\'s Fair Practices Code and Digital Lending Guidelines. This includes disclosure of Key Fact Statement (KFS), loan terms, interest rates, and recovery practices. We operate under strict regulatory supervision to ensure customer protection and transparent lending practices.';
  }
  
  if (message.includes('kyc') || message.includes('verification') || message.includes('authentication')) {
    return 'We use data from Central KYC Registry, UIDAI, and other KYC verification systems in accordance with Prevention of Money Laundering Act, 2002 and RBI\'s KYC Master Directions, 2016. This ensures proper identity verification and regulatory compliance.';
  }
  
  // Loan agreement and obligations
  if (message.includes('loan agreement') || message.includes('contract') || message.includes('obligations')) {
    return 'The loan agreement is executed between you and the lender, not Fundobaba. We facilitate the loan process but the actual lending relationship is with our partner financial institutions. The loan agreement prevails over platform terms in case of any conflict.';
  }
  
  if (message.includes('repayment') || message.includes('outstanding') || message.includes('due') || message.includes('obligations')) {
    return 'You are obliged to repay all outstanding amounts including principal, interest, fees, penalties, and other charges to the lender on or before stipulated due dates. Outstanding amounts continue to be tracked even after app uninstallation or service termination until full repayment.';
  }
  
  if (message.includes('termination') || message.includes('discontinue') || message.includes('stop')) {
    return 'We may terminate services if you breach terms, fail to repay outstanding amounts, or if required by law. Termination does not affect your repayment obligations. You must stop using the platform and repay all outstanding amounts upon termination.';
  }
  
  // Security and liability
  if (message.includes('security') || message.includes('liability') || message.includes('damages') || message.includes('indemnity')) {
    return 'You are responsible for maintaining confidentiality of your credentials. We disclaim liability for unauthorized access or misuse. You agree to indemnify us against claims arising from your use of services. Our liability is limited as per our terms and conditions.';
  }
  
  if (message.includes('force majeure') || message.includes('unavailable') || message.includes('outage')) {
    return 'We are not liable for service unavailability due to events beyond our control including natural disasters, internet outages, system failures, regulatory changes, or other force majeure events. We strive to maintain service continuity but cannot guarantee uninterrupted availability.';
  }
  
  // Customer rights
  if (message.includes('rights') || message.includes('access') || message.includes('update') || message.includes('personal information')) {
    return 'You have the right to access, view, verify, and request corrections to your personal information. You can withdraw consent for data processing and opt out of marketing communications. We ensure your data rights are protected as per applicable laws.';
  }
  
  // Grievance and support
  if (message.includes('grievance') || message.includes('complaint') || message.includes('redressal') || message.includes('swati')) {
    return 'Our Grievance Redressal Officer is Swati Aggarwal. You can contact her at +91-8655367146 or grievance@fundobaba.com. We are committed to addressing customer concerns promptly and effectively as required under the Consumer Protection Act, 2019.';
  }
  
  if (message.includes('contact') || message.includes('support') || message.includes('help') || message.includes('phone')) {
    return 'For general queries: info@fundobaba.com\nFor existing customers: support@fundobaba.com\nPhone: 8882400700\nCustomer Support Hours: 09:00 AM to 05:30 PM (Monday to Saturday)\nGrievance Officer: Swati Aggarwal (+91-8655367146, grievance@fundobaba.com)';
  }
  
  // Platform and services
  if (message.includes('platform') || message.includes('app') || message.includes('website') || message.includes('services')) {
    return 'Fundobaba operates as both a web platform (www.fundobaba.com) and mobile application. Our services facilitate short-term lending solutions through partner financial institutions. The platform enables loan applications, document verification, and loan management.';
  }
  
  if (message.includes('lender') || message.includes('financial institution') || message.includes('partner')) {
    return 'We partner with RBI-registered financial institutions including banks and NBFCs who sanction, process, and disburse loans. These lenders are responsible for loan approval, disbursement, and collection. Fundobaba acts as a facilitator and technology platform.';
  }
  
  // Fundobaba company information
  if (message.includes('fundobaba') || message.includes('about')) {
    return 'Fundobaba is a leading digital lending platform backed by RBI-registered NBFC UY Fincorp. We specialize in quick pay-day loans that are fast, safe, and hassle-free. Our mission is to provide instant financial assistance when you need it most.';
  }
  
  // Pay-day loan specific information
  if (message.includes('pay day') || message.includes('payday') || message.includes('pay-day')) {
    return 'Pay-day loans are short-term loans designed to help you bridge financial gaps until your next paycheck. At Fundobaba, we offer quick pay-day loans with minimal documentation and fast disbursal. These loans are perfect for emergency expenses or temporary cash flow needs.';
  }
  
  if (message.includes('loan amount') || message.includes('how much') || message.includes('maximum')) {
    return 'At Fundobaba, we offer pay-day loans ranging from ₹1,000 to ₹50,000. The exact amount you can borrow depends on your income, credit history, and repayment capacity. Our quick assessment process helps determine the best loan amount for your needs.';
  }
  
  if (message.includes('interest rate') || message.includes('rate') || message.includes('charges')) {
    return 'Our pay-day loan interest rates are competitive and transparent. Rates typically range from 1-3% per month depending on the loan amount and tenure. We believe in complete transparency - all charges are clearly communicated upfront with no hidden fees.';
  }
  
  if (message.includes('tenure') || message.includes('duration') || message.includes('repayment')) {
    return 'Pay-day loans are typically short-term loans with repayment periods ranging from 7 days to 3 months. The exact tenure depends on your loan amount and repayment schedule. We offer flexible repayment options to suit your financial situation.';
  }
  
  // Application process
  if (message.includes('apply') || message.includes('application') || message.includes('process')) {
    return 'Applying for a Fundobaba pay-day loan is simple and fast! Here\'s the process:\n\n1. Fill out our online application form\n2. Upload required documents (ID proof, income proof, bank statements)\n3. Complete our quick verification process\n4. Get instant approval and disbursal\n\nThe entire process usually takes 24-48 hours!';
  }
  
  if (message.includes('document') || message.includes('required') || message.includes('proof')) {
    return 'For a quick pay-day loan, you\'ll need:\n\n• Aadhaar Card or PAN Card (ID proof)\n• Salary slips or bank statements (income proof)\n• Bank account details\n• Recent photograph\n\nThat\'s it! We keep documentation minimal for your convenience.';
  }
  
  if (message.includes('eligibility') || message.includes('qualify') || message.includes('requirements')) {
    return 'To qualify for a Fundobaba pay-day loan, you need:\n\n• Age: 21-65 years\n• Indian resident with valid ID\n• Regular income source\n• Active bank account\n• Good credit history (we also consider first-time borrowers)\n\nWe have flexible eligibility criteria to help more people access quick loans.';
  }
  
  if (message.includes('credit score') || message.includes('credit history') || message.includes('cibil')) {
    return 'While we do check credit scores, we understand that everyone faces financial challenges. Fundobaba considers various factors beyond just credit scores, including income stability and repayment capacity. We also help first-time borrowers build their credit history.';
  }
  
  // Safety and security
  if (message.includes('safe') || message.includes('secure') || message.includes('trust')) {
    return 'Fundobaba is completely safe and secure! We are:\n\n• Backed by RBI-registered NBFC UY Fincorp\n• Compliant with all RBI regulations\n• Use bank-grade security for data protection\n• Transparent about all terms and conditions\n• Have a proven track record of helping thousands of customers\n\nYour financial information and transactions are protected with the highest security standards.';
  }
  
  if (message.includes('hassle') || message.includes('easy') || message.includes('simple')) {
    return 'Absolutely! Fundobaba makes borrowing completely hassle-free:\n\n• 100% online application process\n• Minimal documentation required\n• Quick verification and approval\n• Instant disbursal to your bank account\n• Flexible repayment options\n• 24/7 customer support\n\nNo more waiting in long queues or dealing with complex paperwork!';
  }
  
  if (message.includes('fast') || message.includes('quick') || message.includes('instant')) {
    return 'Speed is our specialty! At Fundobaba:\n\n• Application takes just 5-10 minutes\n• Verification completed within 24 hours\n• Instant approval for eligible customers\n• Disbursal within 24-48 hours\n• No lengthy waiting periods\n\nWe understand that when you need money, you need it fast!';
  }
  
  if (message.includes('hello') || message.includes('hi') || message.includes('hey')) {
    return 'Hello! Welcome to Fundobaba! I\'m here to help you with quick pay-day loans backed by RBI-registered NBFC UY Fincorp. How can I assist you today? You can ask me about loan amounts, application process, eligibility, terms and conditions, or any other questions about our services.';
  }
  
  // NEW FAQ TRAINING DATA BASED ON 100 QUESTIONS
  
  // General Information
  if (message.includes('what is fundobaba') || message.includes('how does fundobaba work') || message.includes('legitimate')) {
    return 'Fundobaba is a digital lending platform that provides instant personal loans with a customer-centric approach. We offer a simple 4-step process: 1) Apply with PAN and mobile, 2) Complete KYC verification, 3) Get instant approval, 4) Receive loan disbursement. We are a legitimate company with proper regulatory compliance and secure financial services.';
  }
  
  if (message.includes('different') || message.includes('stand out') || message.includes('unique')) {
    return 'Fundobaba stands out with its instant approval process, loyalty points system, customer-centric approach, competitive interest rates, and seamless digital experience. We operate 24/7 as a digital platform, allowing you to apply for loans anytime from anywhere.';
  }
  
  if (message.includes('operating hours') || message.includes('24/7') || message.includes('business hours')) {
    return 'Fundobaba operates 24/7 as a digital platform, allowing you to apply for loans anytime from anywhere. Our customer support is available during business hours, with emergency support for urgent issues.';
  }
  
  // Loan Application Process
  if (message.includes('how do i apply') || message.includes('apply for loan') || message.includes('application steps')) {
    return 'To apply for a loan: Visit fundobaba.com, click "Apply Now", enter your PAN and mobile number, verify OTP, and follow the guided application process. The complete process typically takes 10-15 minutes, with instant approval and quick disbursement.';
  }
  
  if (message.includes('documents needed') || message.includes('required documents') || message.includes('pan card')) {
    return 'You need your PAN card (mandatory), mobile number, Aadhaar card for KYC, employment details, and bank statement for verification. PAN card is mandatory for loan application as it\'s required for KYC verification and regulatory compliance.';
  }
  
  if (message.includes('application time') || message.includes('how long') || message.includes('processing time')) {
    return 'The complete application process typically takes 10-15 minutes, with instant approval and quick disbursement. KYC verification is typically instant through the DigiLocker integration.';
  }
  
  if (message.includes('age requirement') || message.includes('minimum age') || message.includes('18 years')) {
    return 'You must be at least 18 years old to apply for a loan on Fundobaba.';
  }
  
  // Loan Eligibility & Amounts
  if (message.includes('minimum loan amount') || message.includes('maximum loan') || message.includes('loan range')) {
    return 'The minimum loan amount is ₹5,000. The maximum loan amount depends on your eligibility and credit score, which is determined during the application process. Your loan amount is determined based on your income, credit score, employment status, and bank statement analysis.';
  }
  
  if (message.includes('multiple loans') || message.includes('second loan') || message.includes('another loan')) {
    return 'You can apply for a new loan after completing repayment of your current loan.';
  }
  
  if (message.includes('loan tenure') || message.includes('duration') || message.includes('repayment period')) {
    return 'Loan tenure varies based on the loan amount and is typically between 30-90 days.';
  }
  
  // Interest Rates & Charges
  if (message.includes('interest rate') || message.includes('rate') || message.includes('charges')) {
    return 'Fundobaba offers competitive interest rates starting from 1% per day, depending on your profile and loan amount. We are transparent about all charges - you\'ll see the complete breakdown including processing fees and interest before accepting the loan.';
  }
  
  if (message.includes('hidden charges') || message.includes('processing fee') || message.includes('fees')) {
    return 'No, Fundobaba is transparent about all charges. Processing fee varies based on loan amount and is clearly displayed during the application process. You\'ll see the complete breakdown including processing fees and interest before accepting the loan.';
  }
  
  if (message.includes('prepayment') || message.includes('early repayment') || message.includes('pay early')) {
    return 'Early repayment is encouraged and may have minimal charges, which are clearly communicated upfront. Repayment amount includes the principal loan amount plus interest and any applicable fees, calculated based on your loan tenure.';
  }
  
  // KYC & Verification
  if (message.includes('kyc process') || message.includes('kyc verification') || message.includes('digilocker')) {
    return 'KYC involves Aadhaar verification through DigiLocker, which is a secure government-approved process for identity verification. All personal information is encrypted and secure. Fundobaba follows strict data protection protocols. If KYC fails, you\'ll receive specific guidance on how to resolve the issue.';
  }
  
  if (message.includes('kyc without aadhaar') || message.includes('aadhaar required')) {
    return 'Aadhaar is required for KYC verification as per regulatory requirements. KYC verification is typically instant through the DigiLocker integration.';
  }
  
  // Employment & Income
  if (message.includes('employment types') || message.includes('salaried') || message.includes('self employed')) {
    return 'Fundobaba accepts salaried employees, self-employed individuals, and business owners. There\'s no fixed minimum income requirement, but your income is considered for loan eligibility assessment. Bank statement analysis is used instead of salary slips for income verification.';
  }
  
  if (message.includes('unemployed') || message.includes('freelancer') || message.includes('income requirement')) {
    return 'You need to have a regular source of income to be eligible for a loan. Freelancers can apply, and their income will be assessed based on bank statement analysis.';
  }
  
  // Bank Statement & Verification
  if (message.includes('bank statement') || message.includes('upload bank') || message.includes('statement format')) {
    return 'Bank statement helps verify your income, spending patterns, and repayment capacity. PDF bank statements from the last 3-6 months are accepted. Bank statements are encrypted and processed securely with bank-level security protocols. Processing typically takes a few minutes to complete.';
  }
  
  if (message.includes('cant access bank statement') || message.includes('download statement')) {
    return 'You can download your bank statement from your bank\'s net banking portal or mobile app.';
  }
  
  // Loan Approval & Disbursement
  if (message.includes('loan approval') || message.includes('approved') || message.includes('disbursement')) {
    return 'You\'ll receive instant approval decision after completing the application process. After approval, you\'ll need to complete e-signing of documents, and the loan will be disbursed to your registered bank account within 24-48 hours.';
  }
  
  if (message.includes('change bank account') || message.includes('different account')) {
    return 'No, the loan will be disbursed to the bank account registered during application.';
  }
  
  if (message.includes('loan rejected') || message.includes('rejection') || message.includes('denied')) {
    return 'If rejected, you\'ll receive specific reasons and can reapply after addressing those concerns.';
  }
  
  // Repayment Process
  if (message.includes('how to repay') || message.includes('repayment methods') || message.includes('pay loan')) {
    return 'You can repay through the Fundobaba app/website using UPI, net banking, or other digital payment methods. Repayment date is clearly mentioned in your loan agreement and sanction letter. Early repayment is encouraged and may have benefits like improved credit score.';
  }
  
  if (message.includes('miss payment') || message.includes('late payment') || message.includes('default')) {
    return 'Late payment charges may apply. It\'s important to contact customer support if you face payment difficulties. Loan extension options may be available, subject to terms and conditions.';
  }
  
  // Loyalty Points System
  if (message.includes('loyalty points') || message.includes('points') || message.includes('rewards')) {
    return 'Loyalty points are rewards you earn for timely repayments and referrals, which can be redeemed for various benefits. You earn points for timely loan repayments and successful referrals of friends and family. Points can be redeemed for instant gifts and rewards through the Fundobaba platform.';
  }
  
  if (message.includes('points expire') || message.includes('validity') || message.includes('redeem points')) {
    return 'Loyalty points have a validity period, which is clearly communicated in the terms. You can redeem points for instant gifts and rewards through the Fundobaba platform.';
  }
  
  // Referral Program
  if (message.includes('referral') || message.includes('refer') || message.includes('refer friends')) {
    return 'Refer friends and family to Fundobaba, and earn ₹500 for each successful loan approval. You can refer any eligible individual who meets the loan criteria. You can track your referrals and earnings through your dashboard. Referral rewards are credited after the referred person\'s loan is disbursed. There\'s no limit on the number of referrals you can make.';
  }
  
  // Insurance Options
  if (message.includes('insurance') || message.includes('icici lombard') || message.includes('coverage')) {
    return 'Fundobaba offers ICICI Lombard General Insurance coverage for loans. Insurance is optional and you can choose whether to opt for it during application. The insurance provides comprehensive coverage for your loan, details of which are provided during application. Insurance premium varies based on loan amount and is clearly displayed during application. Insurance must be opted for during the initial loan application process.';
  }
  
  // Credit Score & Impact
  if (message.includes('credit score') || message.includes('credit check') || message.includes('cibil')) {
    return 'Fundobaba performs a soft credit check which doesn\'t affect your credit score. Timely repayments can improve your credit score, while late payments may have a negative impact. Fundobaba considers various factors beyond just credit score for loan approval. You can get a loan even with a lower credit score as we use alternative data points for assessment.';
  }
  
  if (message.includes('improve credit score') || message.includes('credit history')) {
    return 'Timely repayments, maintaining low credit utilization, and having a mix of credit types can help improve your score.';
  }
  
  // Security & Privacy
  if (message.includes('data secure') || message.includes('privacy') || message.includes('encryption')) {
    return 'Yes, Fundobaba uses bank-level encryption and security protocols to protect your data. We follow strict privacy policies and never share your personal information without consent. The website uses HTTPS encryption and follows industry-standard security practices. Bank account information is encrypted and processed through secure channels.';
  }
  
  if (message.includes('delete account') || message.includes('data deletion')) {
    return 'You can request data deletion as per applicable privacy laws and regulations.';
  }
  
  // Customer Support
  if (message.includes('customer support') || message.includes('contact support') || message.includes('help')) {
    return 'You can contact support through the website, mobile app, or email provided on the platform. Customer support is available during business hours, with emergency support for urgent issues. Support team typically responds within 24 hours, with urgent issues addressed faster.';
  }
  
  if (message.includes('technical issues') || message.includes('technical support') || message.includes('problems')) {
    return 'Technical support is available to help resolve any platform-related issues. You can get help with your application and any technical problems you encounter.';
  }
  
  // Mobile App & Website
  if (message.includes('mobile app') || message.includes('android') || message.includes('ios')) {
    return 'Yes, Fundobaba has a mobile app available for both Android and iOS devices. The complete loan application process can be done through the mobile app. The mobile app has the same security standards as the website. You can track your loan status, make repayments, and manage your account through the app.';
  }
  
  if (message.includes('app features') || message.includes('mobile features')) {
    return 'The app includes loan application, repayment, loyalty points tracking, and customer support features.';
  }
  
  // Loan Status & Tracking
  if (message.includes('loan status') || message.includes('check status') || message.includes('track loan')) {
    return 'You can check your loan status through your dashboard on the website or mobile app. Statuses include: Applied, Under Review, Approved, Disbursed, Active, and Closed. You can download your sanction letter and other loan documents from your dashboard.';
  }
  
  if (message.includes('loan disbursed') || message.includes('disbursement notification')) {
    return 'You\'ll receive SMS and email notifications when your loan is disbursed.';
  }
  
  if (message.includes('loan history') || message.includes('previous loans')) {
    return 'Yes, you can view your complete loan history in your dashboard.';
  }
  
  // Technical Issues
  if (message.includes('website not loading') || message.includes('page not working')) {
    return 'Try refreshing the page, clearing browser cache, or contact technical support if the issue persists. Fundobaba supports all modern browsers including Chrome, Firefox, Safari, and Edge.';
  }
  
  if (message.includes('upload documents') || message.includes('file upload') || message.includes('document upload')) {
    return 'Ensure your file is in the correct format (PDF) and size, or contact support for assistance.';
  }
  
  if (message.includes('otp not received') || message.includes('otp') || message.includes('verification code')) {
    return 'Check your mobile number, wait a few minutes, or use the resend option.';
  }
  
  if (message.includes('session expired') || message.includes('login again')) {
    return 'Simply log in again to continue with your application process.';
  }
  
  // Legal & Compliance
  if (message.includes('rbi registered') || message.includes('regulatory compliance')) {
    return 'Fundobaba operates in compliance with RBI guidelines and applicable financial regulations. Complete terms and conditions are available on the website and must be accepted during application.';
  }
  
  if (message.includes('privacy policy') || message.includes('data policy')) {
    return 'The privacy policy details how your data is collected, used, and protected.';
  }
  
  if (message.includes('legal requirements') || message.includes('borrower rights')) {
    return 'You must be 18+ years old, have a valid PAN and Aadhaar, and meet other eligibility criteria. You have the right to clear information about loan terms, charges, and grievance redressal.';
  }
  
  // Troubleshooting
  if (message.includes('forgot password') || message.includes('login credentials') || message.includes('reset password')) {
    return 'Use the "Forgot Password" option or contact customer support for assistance.';
  }
  
  if (message.includes('application stuck') || message.includes('stuck in process')) {
    return 'Contact customer support with your application reference number for assistance.';
  }
  
  if (message.includes('error message') || message.includes('error') || message.includes('problem')) {
    return 'Note the error message and contact technical support for resolution.';
  }
  
  if (message.includes('payment failed') || message.includes('payment error')) {
    return 'Check your payment method, ensure sufficient funds, and try again or contact support.';
  }
  
  if (message.includes('update information') || message.includes('change details') || message.includes('modify data')) {
    return 'Contact customer support to update any personal or contact information after loan approval.';
  }
  
  // Default response
  return 'Thank you for your question! I\'m here to help you with Fundobaba pay-day loans and services. Could you please be more specific about what you\'d like to know? I can help with loan information, application process, terms and conditions, data privacy, regulatory compliance, or any other aspect of our services.';
}

module.exports = router; 