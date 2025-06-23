const express = require('express');
const Chat = require('../models/Chat');
const { protect } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const NLPService = require('../services/nlpService');

const router = express.Router();

// Initialize NLP Service
const nlpService = new NLPService();

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

// Enhanced Fundobaba-specific response generator with advanced NLP integration
async function generateFundobabaResponse(userMessage, messageHistory) {
  const message = userMessage.toLowerCase();
  
  // Use enhanced NLP service for advanced processing
  const intent = nlpService.recognizeIntent(userMessage);
  const entities = nlpService.extractEntities(userMessage);
  const sentiment = nlpService.analyzeSentiment(userMessage);
  const context = nlpService.understandContext(userMessage, messageHistory);
  
  console.log('🤖 Enhanced NLP Analysis:', {
    intent: intent.intent,
    confidence: intent.confidence,
    entities: entities,
    sentiment: sentiment.score,
    userMood: context.userMood,
    semanticContext: context.semanticContext,
    conversationTopic: context.conversationTopic,
    userJourney: context.userJourney,
    questionType: context.questionType,
    urgency: context.urgency,
    complexity: context.complexity
  });
  
  // Use enhanced fuzzy matching for better accuracy
  const findMatch = (patterns) => nlpService.findPatternMatch(userMessage, patterns);
  
  // Context-aware response generation
  const response = generateContextualResponse(userMessage, context, messageHistory);
  if (response) return response;
  
  // Fallback to pattern matching if no contextual response found
  return generatePatternBasedResponse(userMessage, findMatch);
}

// Generate contextual responses based on understanding
function generateContextualResponse(userMessage, context, messageHistory) {
  const { semanticContext, userJourney, questionType, urgency, complexity } = context;
  
  // Handle different question types with context
  if (questionType === 'what') {
    return handleWhatQuestions(userMessage, semanticContext, userJourney);
  }
  
  if (questionType === 'how') {
    return handleHowQuestions(userMessage, semanticContext, userJourney);
  }
  
  if (questionType === 'can' || questionType === 'could') {
    return handleCapabilityQuestions(userMessage, semanticContext, userJourney);
  }
  
  if (questionType === 'why') {
    return handleWhyQuestions(userMessage, semanticContext, userJourney);
  }
  
  // Handle semantic categories with context
  if (semanticContext.category === 'loan_inquiry') {
    return handleLoanInquiry(userMessage, context, messageHistory);
  }
  
  if (semanticContext.category === 'application_process') {
    return handleApplicationProcess(userMessage, context, messageHistory);
  }
  
  if (semanticContext.category === 'eligibility') {
    return handleEligibility(userMessage, context, messageHistory);
  }
  
  if (semanticContext.category === 'documents') {
    return handleDocuments(userMessage, context, messageHistory);
  }
  
  if (semanticContext.category === 'repayment') {
    return handleRepayment(userMessage, context, messageHistory);
  }
  
  if (semanticContext.category === 'interest_charges') {
    return handleInterestCharges(userMessage, context, messageHistory);
  }
  
  if (semanticContext.category === 'company_info') {
    return handleCompanyInfo(userMessage, context, messageHistory);
  }
  
  if (semanticContext.category === 'support_contact') {
    return handleSupportContact(userMessage, context, messageHistory);
  }
  
  if (semanticContext.category === 'technical_issues') {
    return handleTechnicalIssues(userMessage, context, messageHistory);
  }
  
  if (semanticContext.category === 'loan_status') {
    return handleLoanStatus(userMessage, context, messageHistory);
  }
  
  // Handle EMI specifically
  if (userMessage.toLowerCase().includes('emi') || userMessage.toLowerCase().includes('installment') || userMessage.toLowerCase().includes('monthly payment')) {
    return 'No, we currently don\'t offer EMI format. However, sometimes we do take payment in partial payments when approved by our team. For regular repayment, you need to pay the full amount on the due date.';
  }
  
  return null; // Fallback to pattern matching
}

// Handle "What" questions with context
function handleWhatQuestions(userMessage, semanticContext, userJourney) {
  const message = userMessage.toLowerCase();
  
  if (message.includes('what is fundobaba') || message.includes('what is this')) {
    return 'Fundobaba is a leading digital lending platform backed by RBI-registered NBFC UY Fincorp. We specialize in quick pay-day loans that are fast, safe, and hassle-free. Our mission is to provide instant financial assistance when you need it most.';
  }
  
  if (message.includes('what documents') || message.includes('what papers') || message.includes('what do i need')) {
    return 'For a Fundobaba loan, you only need:\n\n• Mobile number\n• PAN number\n• Aadhaar number\n• Last 3 months bank statement\n\nThat\'s it! We don\'t even need photos of your PAN or Aadhaar cards - just the numbers. We keep it super simple and hassle-free!';
  }
  
  if (message.includes('what amount') || message.includes('what loan amount') || message.includes('how much can i get') || message.includes('what max amount') || message.includes('what maximum amount') || message.includes('what highest amount')) {
    return 'At Fundobaba, we offer pay-day loans ranging from ₹5,000 to ₹1,00,000 (1 lakh). The exact amount you can borrow depends on your income, credit history, and repayment capacity. Our quick assessment process helps determine the best loan amount for your needs.';
  }
  
  if (message.includes('what interest') || message.includes('what rate') || message.includes('what charges')) {
    return 'Our pay-day loan interest rates are competitive and transparent. Rates typically range from 1% per month depending on the loan amount and tenure. We believe in complete transparency - all charges are clearly communicated upfront with no hidden fees.';
  }
  
  if (message.includes('what is the process') || message.includes('what are the steps')) {
    return 'Applying for a Fundobaba pay-day loan is incredibly simple and fast! Here\'s our streamlined process:\n\n1. Enter your mobile number, PAN number, and Aadhaar number\n2. Upload your last 3 months bank statement\n3. Complete e-KYC verification\n4. E-sign the transparent loan document showing all terms\n5. Get loan disbursed in less than 5 minutes!\n\nThat\'s it! No complex paperwork, no document photos needed - just a few simple steps and you get your loan instantly!';
  }
  
  return null;
}

// Handle "How" questions with context
function handleHowQuestions(userMessage, semanticContext, userJourney) {
  const message = userMessage.toLowerCase();
  
  if (message.includes('how to apply') || message.includes('how do i apply')) {
    return 'To apply for a Fundobaba loan:\n\n1. Visit fundobaba.com or download our mobile app\n2. Click "Apply Now" and enter your PAN and mobile number\n3. Verify OTP and complete your profile\n4. Upload your 3-month bank statement\n5. Complete e-KYC verification\n6. E-sign the transparent loan document\n7. Get instant approval and disbursal in under 5 minutes!\n\nIt\'s that simple! No complex paperwork or lengthy processes.';
  }
  
  if (message.includes('how much') && (message.includes('loan') || message.includes('borrow'))) {
    return 'You can borrow between ₹5,000 to ₹1,00,000 (1 lakh) from Fundobaba. The exact amount depends on your income, credit score, and repayment capacity. Our system will show you the maximum amount you\'re eligible for during the application process.';
  }
  
  if (message.includes('how long') && (message.includes('process') || message.includes('time'))) {
    return 'The complete application process takes just 5 minutes! Our e-KYC verification is instant, and once you e-sign the transparent loan document, your loan gets disbursed in less than 5 minutes. No waiting, no delays!';
  }
  
  if (message.includes('how to repay') || message.includes('how do i pay')) {
    return 'Repaying your Fundobaba loan is easy:\n\n1. Go to your dashboard in the app or website\n2. Click on the "Repay" button\n3. Choose your payment method (UPI, net banking, etc.)\n4. Complete the payment\n\nYou can also repay early if you want to save on interest charges. The repayment date is clearly mentioned in your loan agreement.';
  }
  
  return null;
}

// Handle capability questions
function handleCapabilityQuestions(userMessage, semanticContext, userJourney) {
  const message = userMessage.toLowerCase();
  
  if (message.includes('can i get') && message.includes('loan')) {
    return 'Yes, you can get a loan from Fundobaba if you meet our eligibility criteria:\n\n• Age: 21-65 years\n• Indian resident with valid ID\n• Regular income source\n• Active bank account\n• Good credit history (we also consider first-time borrowers)\n\nWe have flexible eligibility criteria to help more people access quick loans.';
  }
  
  if (message.includes('can i apply') || message.includes('can i borrow')) {
    return 'Absolutely! You can apply for a Fundobaba loan right now. Our application process is 100% online and takes just 5 minutes. You can apply through our website or mobile app anytime, anywhere. No need to visit any office or meet anyone in person.';
  }
  
  if (message.includes('can i repay early') || message.includes('can i pay before')) {
    return 'Yes, you can repay your loan early! Early repayment is encouraged and may have benefits like improved credit score. You can make early repayment through your dashboard using UPI, net banking, or other digital payment methods.';
  }
  
  return null;
}

// Handle "Why" questions
function handleWhyQuestions(userMessage, semanticContext, userJourney) {
  const message = userMessage.toLowerCase();
  
  if (message.includes('why fundobaba') || message.includes('why choose')) {
    return 'Fundobaba stands out because:\n\n• Instant approval and disbursal in under 5 minutes\n• Minimal documentation - just PAN, Aadhaar, and bank statement\n• Transparent terms with no hidden charges\n• Backed by RBI-registered NBFC UY Fincorp\n• 24/7 digital platform\n• Excellent customer support\n• Loyalty points and referral rewards\n\nWe make borrowing simple, fast, and trustworthy!';
  }
  
  if (message.includes('why pan') || message.includes('why aadhaar')) {
    return 'PAN and Aadhaar are required because:\n\n• They are mandatory for KYC verification as per RBI regulations\n• They help us verify your identity quickly and securely\n• They are linked to your bank account for loan disbursal\n• They ensure compliance with financial regulations\n• They help prevent fraud and money laundering\n\nThis is standard practice for all financial institutions in India.';
  }
  
  return null;
}

// Handle loan inquiry with context
function handleLoanInquiry(userMessage, context, messageHistory) {
  const { userJourney, urgency } = context;
  
  if (userJourney.stage === 'awareness') {
    return 'Great question! Fundobaba offers quick pay-day loans ranging from ₹5,000 to ₹1,00,000. We\'re backed by RBI-registered NBFC UY Fincorp, so you can trust us completely. Our loans are designed to help you bridge financial gaps until your next paycheck. Would you like to know more about our application process?';
  }
  
  if (urgency.level === 'high') {
    return 'I understand you need quick financial assistance! Fundobaba is perfect for urgent needs - we can disburse loans in under 5 minutes once approved. Our application process is super fast and requires minimal documentation. Would you like to start your application now?';
  }
  
  return 'At Fundobaba, we offer pay-day loans ranging from ₹5,000 to ₹1,00,000 (1 lakh). The exact amount you can borrow depends on your income, credit score, and repayment capacity. Our quick assessment process helps determine the best loan amount for your needs.';
}

// Handle application process with context
function handleApplicationProcess(userMessage, context, messageHistory) {
  const { userJourney, complexity } = context;
  
  if (userJourney.stage === 'consideration') {
    return 'Perfect! You\'re ready to apply. Our process is incredibly simple:\n\n1. Enter your mobile number, PAN number, and Aadhaar number\n2. Upload your last 3 months bank statement\n3. Complete e-KYC verification\n4. E-sign the transparent loan document showing all terms\n5. Get loan disbursed in less than 5 minutes!\n\nNo complex paperwork, no document photos needed - just a few simple steps!';
  }
  
  return 'Applying for a Fundobaba pay-day loan is incredibly simple and fast! Here\'s our streamlined process:\n\n1. Enter your mobile number, PAN number, and Aadhaar number\n2. Upload your last 3 months bank statement\n3. Complete e-KYC verification\n4. E-sign the transparent loan document showing all terms\n5. Get loan disbursed in less than 5 minutes!\n\nThat\'s it! No complex paperwork, no document photos needed - just a few simple steps and you get your loan instantly!';
}

// Handle eligibility with context
function handleEligibility(userMessage, context, messageHistory) {
  const { userJourney } = context;
  
  if (userJourney.stage === 'interest') {
    return 'To qualify for a Fundobaba pay-day loan, you need:\n\n• Age: 21-65 years\n• Indian resident with valid ID\n• Regular income source\n• Active bank account\n• Good credit history (we also consider first-time borrowers)\n\nWe have flexible eligibility criteria to help more people access quick loans. Would you like to check if you\'re eligible?';
  }
  
  return 'To get a loan from Fundobaba, you need:\n\n• CIBIL score greater than 600\n• Salary greater than ₹40,000 per month\n• PAN and Aadhaar should be linked\n• 3 months bank statement ready\n\nMake sure you have all these documents handy before applying!';
}

// Handle documents with context
function handleDocuments(userMessage, context, messageHistory) {
  const { userJourney } = context;
  
  if (userJourney.stage === 'consideration') {
    return 'For your application, you\'ll need:\n\n• Mobile number\n• PAN number\n• Aadhaar number\n• Last 3 months bank statement\n\nThat\'s it! We don\'t even need photos of your PAN or Aadhaar cards - just the numbers. We keep it super simple and hassle-free!';
  }
  
  return 'For a Fundobaba loan, you only need:\n\n• Mobile number\n• PAN number\n• Aadhaar number\n• Last 3 months bank statement\n\nThat\'s it! We don\'t even need photos of your PAN or Aadhaar cards - just the numbers. We keep it super simple and hassle-free!';
}

// Handle repayment with context
function handleRepayment(userMessage, context, messageHistory) {
  const { userJourney } = context;
  
  if (userJourney.stage === 'post_application') {
    return 'To repay your loan:\n\n1. Go to your dashboard in the app or website\n2. Click on the "Repay" button\n3. Choose your payment method (UPI, net banking, etc.)\n4. Complete the payment\n\nYou can also repay early if you want to save on interest charges. The repayment date is clearly mentioned in your loan agreement.';
  }
  
  return 'We\'ll show you the repayment date of your loan on the loan document. And if you have received the loan, just visit your dashboard and check the repayment date of your loan. Click on the repayment button to make the repayment.';
}

// Handle interest and charges with context
function handleInterestCharges(userMessage, context, messageHistory) {
  const { userJourney } = context;
  
  if (userJourney.stage === 'interest') {
    return 'Our interest rates are competitive and transparent:\n\n• Starting from 1% per month\n• No hidden charges\n• All fees clearly communicated upfront\n• Transparent loan document shows all terms\n\nWe believe in complete transparency - you\'ll see exactly what you\'re paying before you sign.';
  }
  
  return 'Our pay-day loan interest rates are competitive and transparent. Rates typically range from 1% per month depending on the loan amount and tenure. We believe in complete transparency - all charges are clearly communicated upfront with no hidden fees.';
}

// Handle company info with context
function handleCompanyInfo(userMessage, context, messageHistory) {
  const { userJourney } = context;
  
  if (userJourney.stage === 'awareness') {
    return 'Fundobaba is a leading digital lending platform backed by RBI-registered NBFC UY Fincorp. We specialize in quick pay-day loans that are fast, safe, and hassle-free. Our mission is to provide instant financial assistance when you need it most. We\'re completely legitimate and regulated by RBI.';
  }
  
  return 'Fundobaba is a leading digital lending platform backed by RBI-registered NBFC UY Fincorp. We specialize in quick pay-day loans that are fast, safe, and hassle-free. Our mission is to provide instant financial assistance when you need it most.';
}

// Handle support contact with context
function handleSupportContact(userMessage, context, messageHistory) {
  const { urgency } = context;
  
  if (urgency.level === 'high') {
    return 'For urgent support, please call us immediately at +91 8882400700. Our support team is available from 09:00 AM to 05:30 PM (Monday to Saturday). For general queries, you can also email us at support@fundobaba.com.';
  }
  
  return 'Call Support: +91 8882400700\nEmail Support: support@fundobaba.com\nFor general queries: info@fundobaba.com\nCustomer Support Hours: 09:00 AM to 05:30 PM (Monday to Saturday)\nGrievance Officer: Swati Aggarwal (+91-8655367146, grievance@fundobaba.com)\n\nCorporate Office:\nVaman Techno Centre B-Wing, Ground Floor,\nMarol Naka, Makwana Road\nOff Andheri-Kurla Road, Andheri East,\nMumbai, 400059';
}

// Handle technical issues with context
function handleTechnicalIssues(userMessage, context, messageHistory) {
  return 'I\'m sorry you\'re experiencing technical issues. Please try:\n\n1. Refreshing the page or restarting the app\n2. Clearing your browser cache\n3. Checking your internet connection\n\nIf the problem persists, please contact our technical support at +91 8882400700 or email us at support@fundobaba.com. We\'ll help you resolve the issue quickly.';
}

// Handle loan status with context
function handleLoanStatus(userMessage, context, messageHistory) {
  return 'You can check your loan status through your dashboard on the website or mobile app. Statuses include: Applied, Under Review, Approved, Disbursed, Active, and Closed. You can download your sanction letter and other loan documents from your dashboard.';
}

// Fallback pattern-based response generation with comprehensive scoring
function generatePatternBasedResponse(userMessage, findMatch) {
  const message = userMessage.toLowerCase();
  
  // Define all possible response patterns with their responses
  const responsePatterns = [
    // EMI and payment patterns
    { pattern: 'emi', response: 'No, we currently don\'t offer EMI format. However, sometimes we do take payment in partial payments when approved by our team. For regular repayment, you need to pay the full amount on the due date.' },
    { pattern: 'installment', response: 'No, we currently don\'t offer EMI format. However, sometimes we do take payment in partial payments when approved by our team. For regular repayment, you need to pay the full amount on the due date.' },
    { pattern: 'monthly payment', response: 'No, we currently don\'t offer EMI format. However, sometimes we do take payment in partial payments when approved by our team. For regular repayment, you need to pay the full amount on the due date.' },
    
    // Loan amount patterns
    { pattern: 'max loan', response: 'We offer loan amounts ranging from ₹5,000 to ₹1,00,000 (1 lakh). The exact amount you can borrow depends on your income, credit score, and repayment capacity.' },
    { pattern: 'maximum loan', response: 'We offer loan amounts ranging from ₹5,000 to ₹1,00,000 (1 lakh). The exact amount you can borrow depends on your income, credit score, and repayment capacity.' },
    { pattern: 'highest loan', response: 'We offer loan amounts ranging from ₹5,000 to ₹1,00,000 (1 lakh). The exact amount you can borrow depends on your income, credit score, and repayment capacity.' },
    { pattern: 'loan range', response: 'We offer loan amounts ranging from ₹5,000 to ₹1,00,000 (1 lakh). The exact amount you can borrow depends on your income, credit score, and repayment capacity.' },
    { pattern: 'max amount', response: 'We offer loan amounts ranging from ₹5,000 to ₹1,00,000 (1 lakh). The exact amount you can borrow depends on your income, credit score, and repayment capacity.' },
    { pattern: 'maximum amount', response: 'We offer loan amounts ranging from ₹5,000 to ₹1,00,000 (1 lakh). The exact amount you can borrow depends on your income, credit score, and repayment capacity.' },
    { pattern: 'highest amount', response: 'We offer loan amounts ranging from ₹5,000 to ₹1,00,000 (1 lakh). The exact amount you can borrow depends on your income, credit score, and repayment capacity.' },
    
    // Minimum loan patterns
    { pattern: 'min loan', response: 'The minimum loan amount we offer is ₹5,000.' },
    { pattern: 'minimum loan', response: 'The minimum loan amount we offer is ₹5,000.' },
    { pattern: 'lowest loan', response: 'The minimum loan amount we offer is ₹5,000.' },
    { pattern: 'min amount', response: 'The minimum loan amount we offer is ₹5,000.' },
    { pattern: 'minimum amount', response: 'The minimum loan amount we offer is ₹5,000.' },
    
    // Salary patterns
    { pattern: 'salary', response: 'The minimum salary requirement to take a loan is ₹40,000 per month. This helps ensure you have sufficient income to repay the loan comfortably.' },
    { pattern: 'income', response: 'The minimum salary requirement to take a loan is ₹40,000 per month. This helps ensure you have sufficient income to repay the loan comfortably.' },
    { pattern: 'minimum salary', response: 'The minimum salary requirement to take a loan is ₹40,000 per month. This helps ensure you have sufficient income to repay the loan comfortably.' },
    { pattern: 'salary requirement', response: 'The minimum salary requirement to take a loan is ₹40,000 per month. This helps ensure you have sufficient income to repay the loan comfortably.' },
    { pattern: 'income requirement', response: 'The minimum salary requirement to take a loan is ₹40,000 per month. This helps ensure you have sufficient income to repay the loan comfortably.' },
    
    // Repayment patterns
    { pattern: 'dont repay', response: 'You are obliged to repay the loan. If you don\'t repay on time, your CIBIL score will decrease, which can affect your future loan applications. To repay, go to your dashboard and click on the repayment button to make the payment.' },
    { pattern: 'don\'t repay', response: 'You are obliged to repay the loan. If you don\'t repay on time, your CIBIL score will decrease, which can affect your future loan applications. To repay, go to your dashboard and click on the repayment button to make the payment.' },
    { pattern: 'not repay', response: 'You are obliged to repay the loan. If you don\'t repay on time, your CIBIL score will decrease, which can affect your future loan applications. To repay, go to your dashboard and click on the repayment button to make the payment.' },
    { pattern: 'miss payment', response: 'You are obliged to repay the loan. If you don\'t repay on time, your CIBIL score will decrease, which can affect your future loan applications. To repay, go to your dashboard and click on the repayment button to make the payment.' },
    { pattern: 'late payment', response: 'You are obliged to repay the loan. If you don\'t repay on time, your CIBIL score will decrease, which can affect your future loan applications. To repay, go to your dashboard and click on the repayment button to make the payment.' },
    { pattern: 'default', response: 'You are obliged to repay the loan. If you don\'t repay on time, your CIBIL score will decrease, which can affect your future loan applications. To repay, go to your dashboard and click on the repayment button to make the payment.' },
    
    // Loan criteria patterns
    { pattern: 'criteria', response: 'To get a loan from Fundobaba, you need:\n\n• CIBIL score greater than 600\n• Salary greater than ₹40,000 per month\n• PAN and Aadhaar should be linked\n• 3 months bank statement ready\n\nMake sure you have all these documents handy before applying!' },
    { pattern: 'eligibility criteria', response: 'To get a loan from Fundobaba, you need:\n\n• CIBIL score greater than 600\n• Salary greater than ₹40,000 per month\n• PAN and Aadhaar should be linked\n• 3 months bank statement ready\n\nMake sure you have all these documents handy before applying!' },
    { pattern: 'loan criteria', response: 'To get a loan from Fundobaba, you need:\n\n• CIBIL score greater than 600\n• Salary greater than ₹40,000 per month\n• PAN and Aadhaar should be linked\n• 3 months bank statement ready\n\nMake sure you have all these documents handy before applying!' },
    { pattern: 'requirements', response: 'To get a loan from Fundobaba, you need:\n\n• CIBIL score greater than 600\n• Salary greater than ₹40,000 per month\n• PAN and Aadhaar should be linked\n• 3 months bank statement ready\n\nMake sure you have all these documents handy before applying!' },
    { pattern: 'qualification', response: 'To get a loan from Fundobaba, you need:\n\n• CIBIL score greater than 600\n• Salary greater than ₹40,000 per month\n• PAN and Aadhaar should be linked\n• 3 months bank statement ready\n\nMake sure you have all these documents handy before applying!' },
    { pattern: 'what needed', response: 'To get a loan from Fundobaba, you need:\n\n• CIBIL score greater than 600\n• Salary greater than ₹40,000 per month\n• PAN and Aadhaar should be linked\n• 3 months bank statement ready\n\nMake sure you have all these documents handy before applying!' },
    { pattern: 'eligible', response: 'To get a loan from Fundobaba, you need:\n\n• CIBIL score greater than 600\n• Salary greater than ₹40,000 per month\n• PAN and Aadhaar should be linked\n• 3 months bank statement ready\n\nMake sure you have all these documents handy before applying!' },
    
    // Reloan patterns
    { pattern: 'reloan', response: 'To take a reloan:\n\n1. Close your previous loan if you have any active loan\n2. Go to your dashboard\n3. Click on the reloan button to take the loan\n\nThat\'s it! You can take reloan multiple times if you need to.' },
    { pattern: 're loan', response: 'To take a reloan:\n\n1. Close your previous loan if you have any active loan\n2. Go to your dashboard\n3. Click on the reloan button to take the loan\n\nThat\'s it! You can take reloan multiple times if you need to.' },
    { pattern: 'another loan', response: 'To take a reloan:\n\n1. Close your previous loan if you have any active loan\n2. Go to your dashboard\n3. Click on the reloan button to take the loan\n\nThat\'s it! You can take reloan multiple times if you need to.' },
    { pattern: 'second loan', response: 'To take a reloan:\n\n1. Close your previous loan if you have any active loan\n2. Go to your dashboard\n3. Click on the reloan button to take the loan\n\nThat\'s it! You can take reloan multiple times if you need to.' },
    { pattern: 'next loan', response: 'To take a reloan:\n\n1. Close your previous loan if you have any active loan\n2. Go to your dashboard\n3. Click on the reloan button to take the loan\n\nThat\'s it! You can take reloan multiple times if you need to.' },
    { pattern: 'take another loan', response: 'To take a reloan:\n\n1. Close your previous loan if you have any active loan\n2. Go to your dashboard\n3. Click on the reloan button to take the loan\n\nThat\'s it! You can take reloan multiple times if you need to.' },
    { pattern: 'how to take reloan', response: 'To take a reloan:\n\n1. Close your previous loan if you have any active loan\n2. Go to your dashboard\n3. Click on the reloan button to take the loan\n\nThat\'s it! You can take reloan multiple times if you need to.' },
    
    // Gratitude patterns
    { pattern: 'thank', response: 'You\'re most welcome! I\'m glad I could help you with Fundobaba\'s loan services. Feel free to reach out anytime if you have more questions about our quick pay-day loans or application process.' },
    { pattern: 'thank you so much', response: 'You\'re most welcome! I\'m glad I could help you with Fundobaba\'s loan services. Feel free to reach out anytime if you have more questions about our quick pay-day loans or application process.' },
    { pattern: 'appreciate it', response: 'You\'re most welcome! I\'m glad I could help you with Fundobaba\'s loan services. Feel free to reach out anytime if you have more questions about our quick pay-day loans or application process.' },
    { pattern: 'much appreciated', response: 'You\'re most welcome! I\'m glad I could help you with Fundobaba\'s loan services. Feel free to reach out anytime if you have more questions about our quick pay-day loans or application process.' },
    { pattern: 'thnx', response: 'You\'re most welcome! I\'m glad I could help you with Fundobaba\'s loan services. Feel free to reach out anytime if you have more questions about our quick pay-day loans or application process.' },
    { pattern: 'thanks', response: 'You\'re most welcome! I\'m glad I could help you with Fundobaba\'s loan services. Feel free to reach out anytime if you have more questions about our quick pay-day loans or application process.' },
    
    // Understanding patterns
    { pattern: 'got it', response: 'Great! I\'m glad that helps. Is there anything else you\'d like to know about Fundobaba\'s loan services? I\'m here to assist you with any questions about our quick pay-day loans, application process, or other services.' },
    { pattern: 'ok', response: 'Great! I\'m glad that helps. Is there anything else you\'d like to know about Fundobaba\'s loan services? I\'m here to assist you with any questions about our quick pay-day loans, application process, or other services.' },
    { pattern: 'okay', response: 'Great! I\'m glad that helps. Is there anything else you\'d like to know about Fundobaba\'s loan services? I\'m here to assist you with any questions about our quick pay-day loans, application process, or other services.' },
    { pattern: 'alright', response: 'Great! I\'m glad that helps. Is there anything else you\'d like to know about Fundobaba\'s loan services? I\'m here to assist you with any questions about our quick pay-day loans, application process, or other services.' },
    { pattern: 'understood', response: 'Great! I\'m glad that helps. Is there anything else you\'d like to know about Fundobaba\'s loan services? I\'m here to assist you with any questions about our quick pay-day loans, application process, or other services.' },
    { pattern: 'makes sense', response: 'Great! I\'m glad that helps. Is there anything else you\'d like to know about Fundobaba\'s loan services? I\'m here to assist you with any questions about our quick pay-day loans, application process, or other services.' },
    { pattern: 'i see', response: 'Great! I\'m glad that helps. Is there anything else you\'d like to know about Fundobaba\'s loan services? I\'m here to assist you with any questions about our quick pay-day loans, application process, or other services.' },
    { pattern: 'gotcha', response: 'Great! I\'m glad that helps. Is there anything else you\'d like to know about Fundobaba\'s loan services? I\'m here to assist you with any questions about our quick pay-day loans, application process, or other services.' },
    { pattern: 'cool', response: 'Great! I\'m glad that helps. Is there anything else you\'d like to know about Fundobaba\'s loan services? I\'m here to assist you with any questions about our quick pay-day loans, application process, or other services.' },
    { pattern: 'sounds good', response: 'Great! I\'m glad that helps. Is there anything else you\'d like to know about Fundobaba\'s loan services? I\'m here to assist you with any questions about our quick pay-day loans, application process, or other services.' },
    { pattern: 'noted', response: 'Great! I\'m glad that helps. Is there anything else you\'d like to know about Fundobaba\'s loan services? I\'m here to assist you with any questions about our quick pay-day loans, application process, or other services.' },
    { pattern: 'copy that', response: 'Great! I\'m glad that helps. Is there anything else you\'d like to know about Fundobaba\'s loan services? I\'m here to assist you with any questions about our quick pay-day loans, application process, or other services.' },
    
    // Closing patterns
    { pattern: 'thats all', response: 'Perfect! I\'m glad I could help you with Fundobaba\'s services. If you need any assistance with our quick pay-day loans in the future, feel free to reach out. Good luck with your application!' },
    { pattern: 'that\'s all', response: 'Perfect! I\'m glad I could help you with Fundobaba\'s services. If you need any assistance with our quick pay-day loans in the future, feel free to reach out. Good luck with your application!' },
    { pattern: 'no further questions', response: 'Perfect! I\'m glad I could help you with Fundobaba\'s services. If you need any assistance with our quick pay-day loans in the future, feel free to reach out. Good luck with your application!' },
    { pattern: 'that helps', response: 'Perfect! I\'m glad I could help you with Fundobaba\'s services. If you need any assistance with our quick pay-day loans in the future, feel free to reach out. Good luck with your application!' },
    { pattern: 'will check', response: 'Perfect! I\'m glad I could help you with Fundobaba\'s services. If you need any assistance with our quick pay-day loans in the future, feel free to reach out. Good luck with your application!' },
    { pattern: 'will try that', response: 'Perfect! I\'m glad I could help you with Fundobaba\'s services. If you need any assistance with our quick pay-day loans in the future, feel free to reach out. Good luck with your application!' },
    { pattern: 'ill get back', response: 'Perfect! I\'m glad I could help you with Fundobaba\'s services. If you need any assistance with our quick pay-day loans in the future, feel free to reach out. Good luck with your application!' },
    { pattern: 'i\'ll get back', response: 'Perfect! I\'m glad I could help you with Fundobaba\'s services. If you need any assistance with our quick pay-day loans in the future, feel free to reach out. Good luck with your application!' },
    { pattern: 'talk later', response: 'Perfect! I\'m glad I could help you with Fundobaba\'s services. If you need any assistance with our quick pay-day loans in the future, feel free to reach out. Good luck with your application!' },
    
    // Help patterns
    { pattern: 'help me', response: 'I\'m here to help you with Fundobaba\'s quick pay-day loan services. How can I assist you today?' },
    { pattern: 'help', response: 'I\'m here to help you with Fundobaba\'s quick pay-day loan services. How can I assist you today?' },
    { pattern: 'assist', response: 'I\'m here to help you with Fundobaba\'s quick pay-day loan services. How can I assist you today?' },
    { pattern: 'support', response: 'I\'m here to help you with Fundobaba\'s quick pay-day loan services. How can I assist you today?' }
  ];
  
  // Extract patterns for scoring
  const patterns = responsePatterns.map(rp => rp.pattern);
  
  // Use comprehensive scoring system
  const bestMatch = nlpService.selectBestResponse(userMessage, patterns, 0.3);
  
  if (bestMatch) {
    console.log(`🎯 Best match: "${bestMatch.pattern}" with score ${bestMatch.score.toFixed(2)}`);
    const selectedResponse = responsePatterns.find(rp => rp.pattern === bestMatch.pattern);
    return selectedResponse.response;
  }
  
  // Default response if no good match found
  return 'Thank you for your question! I\'m here to help you with Fundobaba pay-day loans and services. Could you please be more specific about what you\'d like to know? I can help with loan information, application process, terms and conditions, data privacy, regulatory compliance, or any other aspect of our services.';
}

module.exports = router; 