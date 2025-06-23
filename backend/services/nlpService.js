const natural = require('natural');
const nlp = require('compromise');
const stringSimilarity = require('string-similarity');
const Fuse = require('fuse.js');

class NLPService {
  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.stemmer = natural.PorterStemmer;
    this.tfidf = new natural.TfIdf();
    
    // Initialize training data
    this.initializeTrainingData();
  }

  initializeTrainingData() {
    // Training data for intent recognition
    this.intentTrainingData = {
      'loan_inquiry': [
        'how much loan can i get',
        'what is the maximum loan amount',
        'loan amount range',
        'borrow money',
        'get loan',
        'loan amount'
      ],
      'application_process': [
        'how to apply',
        'application process',
        'apply for loan',
        'loan application steps',
        'how do i apply',
        'application procedure'
      ],
      'eligibility': [
        'am i eligible',
        'eligibility criteria',
        'loan requirements',
        'qualify for loan',
        'can i get loan',
        'loan criteria'
      ],
      'repayment': [
        'how to repay',
        'repayment process',
        'emi options',
        'payment methods',
        'repay loan',
        'due date'
      ],
      'contact_support': [
        'contact support',
        'help me',
        'customer service',
        'talk to human',
        'phone number',
        'email support'
      ],
      'greeting': [
        'hello',
        'hi',
        'hey',
        'good morning',
        'good evening',
        'namaste'
      ],
      'gratitude': [
        'thank you',
        'thanks',
        'appreciate it',
        'thank you so much'
      ],
      'farewell': [
        'bye',
        'goodbye',
        'see you',
        'talk later'
      ]
    };

    // Add training data to TF-IDF
    Object.entries(this.intentTrainingData).forEach(([intent, phrases]) => {
      phrases.forEach(phrase => {
        this.tfidf.addDocument(phrase, intent);
      });
    });
  }

  // Intent Recognition using TF-IDF
  recognizeIntent(message) {
    const messageLower = message.toLowerCase();
    const scores = {};
    
    // Calculate TF-IDF scores
    this.tfidf.tfidfs(messageLower, (i, measure, key) => {
      if (!scores[key]) scores[key] = 0;
      scores[key] += measure;
    });

    // Find the intent with highest score
    let bestIntent = 'general_inquiry';
    let bestScore = 0;

    Object.entries(scores).forEach(([intent, score]) => {
      if (score > bestScore) {
        bestScore = score;
        bestIntent = intent;
      }
    });

    return {
      intent: bestIntent,
      confidence: bestScore,
      scores: scores
    };
  }

  // Entity Extraction using compromise
  extractEntities(message) {
    try {
      const doc = nlp(message);
      
      const entities = {
        amounts: [],
        dates: [],
        contact_info: [],
        documents: [],
        organizations: [],
        locations: []
      };

      // Extract amounts - more robust approach
      try {
        const amounts = doc.values().toNumber().out('array');
        entities.amounts = amounts || [];
      } catch (error) {
        console.log('Amount extraction error:', error.message);
        entities.amounts = [];
      }

      // Extract dates - more robust approach
      try {
        if (doc.dates && typeof doc.dates === 'function') {
          const dates = doc.dates().out('array');
          entities.dates = dates || [];
        } else {
          // Fallback date extraction using regex
          const datePatterns = [
            /\d{1,2}\/\d{1,2}\/\d{4}/g,
            /\d{1,2}-\d{1,2}-\d{4}/g,
            /\d{4}-\d{1,2}-\d{1,2}/g
          ];
          const foundDates = [];
          datePatterns.forEach(pattern => {
            const matches = message.match(pattern);
            if (matches) foundDates.push(...matches);
          });
          entities.dates = foundDates;
        }
      } catch (error) {
        console.log('Date extraction error:', error.message);
        entities.dates = [];
      }

      // Extract organizations - more robust approach
      try {
        if (doc.organizations && typeof doc.organizations === 'function') {
          const orgs = doc.organizations().out('array');
          entities.organizations = orgs || [];
        } else {
          entities.organizations = [];
        }
      } catch (error) {
        console.log('Organization extraction error:', error.message);
        entities.organizations = [];
      }

      // Extract locations - more robust approach
      try {
        if (doc.places && typeof doc.places === 'function') {
          const places = doc.places().out('array');
          entities.locations = places || [];
        } else {
          entities.locations = [];
        }
      } catch (error) {
        console.log('Location extraction error:', error.message);
        entities.locations = [];
      }

      // Extract document types
      const documentKeywords = ['pan', 'aadhaar', 'adhar', 'bank statement', 'salary slip', 'passport'];
      documentKeywords.forEach(docType => {
        if (message.toLowerCase().includes(docType)) {
          entities.documents.push(docType);
        }
      });

      // Extract contact information
      const phonePattern = /(\+91\s?)?[789]\d{9}/g;
      const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      
      const phones = message.match(phonePattern);
      const emails = message.match(emailPattern);
      
      if (phones) entities.contact_info.push(...phones);
      if (emails) entities.contact_info.push(...emails);

      return entities;
    } catch (error) {
      console.log('Entity extraction error:', error.message);
      // Return basic entities if compromise fails
      return {
        amounts: [],
        dates: [],
        contact_info: [],
        documents: [],
        organizations: [],
        locations: []
      };
    }
  }

  // Enhanced Fuzzy String Matching with Keyword Detection
  findBestMatch(userMessage, patterns, threshold = 0.6) {
    const messageLower = userMessage.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;

    patterns.forEach(pattern => {
      const keywords = Array.isArray(pattern) ? pattern : [pattern];
      
      keywords.forEach(keyword => {
        const keywordLower = keyword.toLowerCase();
        
        // Method 1: Exact substring match (highest priority)
        if (messageLower.includes(keywordLower)) {
          const score = 1.0;
          if (score > bestScore) {
            bestScore = score;
            bestMatch = pattern;
          }
        }
        // Method 2: Word boundary matching
        else if (this.hasWordBoundaryMatch(messageLower, keywordLower)) {
          const score = 0.9;
          if (score > bestScore) {
            bestScore = score;
            bestMatch = pattern;
          }
        }
        // Method 3: String similarity for typos and variations
        else {
          const similarity = stringSimilarity.compareTwoStrings(messageLower, keywordLower);
          if (similarity > bestScore && similarity >= threshold) {
            bestScore = similarity;
            bestMatch = pattern;
          }
        }
      });
    });

    return {
      match: bestMatch,
      confidence: bestScore
    };
  }

  // Check if keywords appear as whole words in the message
  hasWordBoundaryMatch(message, keyword) {
    const words = message.split(/\s+/);
    const keywordWords = keyword.split(/\s+/);
    
    // Check if all keyword words are present in the message
    return keywordWords.every(kw => 
      words.some(word => word.includes(kw) || kw.includes(word))
    );
  }

  // Enhanced pattern matching for common variations
  findPatternMatch(userMessage, patterns) {
    const messageLower = userMessage.toLowerCase();
    
    // Common variations and synonyms
    const variations = {
      'max loan': ['max loan', 'maximum loan', 'highest loan', 'loan range', 'loan amount range', 'max amount', 'maximum amount', 'highest amount', 'what max amount', 'what maximum amount', 'what highest amount', 'max amount anyone can get', 'maximum amount anyone can get'],
      'min loan': ['min loan', 'minimum loan', 'lowest loan', 'minimum amount', 'lowest amount', 'what min amount', 'what minimum amount'],
      'emi': ['emi', 'installment', 'monthly payment', 'partial payment', 'monthly emi', 'installment payment'],
      'salary': ['salary', 'income', 'minimum salary', 'salary requirement', 'income requirement', 'salary needed', 'income needed'],
      'repayment': ['dont repay', 'don\'t repay', 'not repay', 'miss payment', 'late payment', 'default', 'what if not repay', 'don\'t pay', 'not pay', 'repayment', 'repay', 'payment'],
      'criteria': ['criteria', 'eligibility criteria', 'loan criteria', 'requirements', 'qualification', 'what needed', 'eligible', 'eligibility'],
      'reloan': ['reloan', 're loan', 'another loan', 'second loan', 'next loan', 'take another loan', 'how to take reloan'],
      'thank': ['thank', 'thank you so much', 'appreciate it', 'much appreciated', 'thnx', 'thanks'],
      'understanding': ['got it', 'ok', 'okay', 'alright', 'understood', 'makes sense', 'i see', 'gotcha', 'cool', 'sounds good', 'noted', 'copy that'],
      'closing': ['thats all', 'that\'s all', 'no further questions', 'that helps', 'will check', 'will try that', 'ill get back', 'i\'ll get back', 'talk later'],
      'help': ['help me', 'help', 'assist', 'support']
    };

    // Check for pattern matches with variations
    for (const [pattern, patternVariations] of Object.entries(variations)) {
      for (const variation of patternVariations) {
        if (messageLower.includes(variation.toLowerCase())) {
          return {
            match: pattern,
            confidence: 0.95,
            matchedVariation: variation
          };
        }
      }
    }

    // Fallback to original fuzzy matching
    return this.findBestMatch(userMessage, patterns, 0.6);
  }

  // Advanced Fuzzy Search using Fuse.js
  fuzzySearch(userMessage, searchData, options = {}) {
    const defaultOptions = {
      threshold: 0.6,
      distance: 100,
      keys: ['text', 'keywords'],
      includeScore: true
    };

    const fuse = new Fuse(searchData, { ...defaultOptions, ...options });
    const results = fuse.search(userMessage);

    return results.map(result => ({
      item: result.item,
      score: result.score,
      confidence: 1 - result.score
    }));
  }

  // Sentiment Analysis
  analyzeSentiment(message) {
    try {
      const doc = nlp(message);
      
      // Check if sentiment method exists
      if (doc.sentiment && typeof doc.sentiment === 'function') {
        const sentiment = doc.sentiment();
        
        return {
          score: sentiment.score || 0,
          positive: sentiment.positive || 0,
          negative: sentiment.negative || 0,
          neutral: sentiment.neutral || 0
        };
      } else {
        // Fallback sentiment analysis
        return this.fallbackSentimentAnalysis(message);
      }
    } catch (error) {
      console.log('Sentiment analysis error:', error.message);
      // Fallback sentiment analysis
      return this.fallbackSentimentAnalysis(message);
    }
  }

  // Fallback sentiment analysis
  fallbackSentimentAnalysis(message) {
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'happy', 'thank', 'thanks', 'appreciate', 'love', 'like', 'perfect', 'awesome', 'fantastic', 'brilliant', 'outstanding'];
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'sad', 'angry', 'frustrated', 'disappointed', 'hate', 'dislike', 'worst', 'useless', 'stupid', 'annoying', 'problem', 'issue', 'error'];
    
    const messageLower = message.toLowerCase();
    let positiveCount = 0;
    let negativeCount = 0;
    
    positiveWords.forEach(word => {
      if (messageLower.includes(word)) positiveCount++;
    });
    
    negativeWords.forEach(word => {
      if (messageLower.includes(word)) negativeCount++;
    });
    
    const total = positiveCount + negativeCount;
    const score = total > 0 ? (positiveCount - negativeCount) / total : 0;
    
    return {
      score: score,
      positive: positiveCount,
      negative: negativeCount,
      neutral: total === 0 ? 1 : 0
    };
  }

  // Keyword Extraction
  extractKeywords(message, maxKeywords = 5) {
    try {
      const doc = nlp(message);
      
      // Check if keywords method exists
      if (doc.keywords && typeof doc.keywords === 'function') {
        const keywords = doc.keywords().out('array');
        return keywords.slice(0, maxKeywords);
      } else {
        // Fallback keyword extraction
        return this.fallbackKeywordExtraction(message, maxKeywords);
      }
    } catch (error) {
      console.log('Keyword extraction error:', error.message);
      // Fallback keyword extraction
      return this.fallbackKeywordExtraction(message, maxKeywords);
    }
  }

  // Fallback keyword extraction
  fallbackKeywordExtraction(message, maxKeywords = 5) {
    const words = message.toLowerCase().split(/\s+/);
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'what', 'how', 'when', 'where', 'why', 'who', 'which'];
    
    const filteredWords = words.filter(word => 
      word.length > 2 && !stopWords.includes(word) && /^[a-zA-Z]+$/.test(word)
    );
    
    // Count word frequency
    const wordCount = {};
    filteredWords.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });
    
    // Sort by frequency and return top keywords
    const sortedWords = Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, maxKeywords)
      .map(([word]) => word);
    
    return sortedWords;
  }

  // Spell Check and Correction
  spellCheck(message) {
    const words = this.tokenizer.tokenize(message);
    const correctedWords = words.map(word => {
      const stemmed = this.stemmer.stem(word);
      // Basic spell check - in production, you'd use a proper dictionary
      return word;
    });
    
    return correctedWords.join(' ');
  }

  // Enhanced Context Understanding with Semantic Analysis
  understandContext(message, conversationHistory = []) {
    const intent = this.recognizeIntent(message);
    const entities = this.extractEntities(message);
    const sentiment = this.analyzeSentiment(message);
    const keywords = this.extractKeywords(message);
    const semanticContext = this.analyzeSemanticContext(message, conversationHistory);

    // Analyze conversation context
    const context = {
      currentIntent: intent,
      entities: entities,
      sentiment: sentiment,
      keywords: keywords,
      conversationLength: conversationHistory.length,
      previousIntents: conversationHistory.slice(-3).map(msg => 
        this.recognizeIntent(msg.content || msg)
      ),
      isFollowUp: conversationHistory.length > 0,
      userMood: this.analyzeUserMood(sentiment, conversationHistory),
      semanticContext: semanticContext,
      conversationTopic: this.identifyConversationTopic(conversationHistory),
      userJourney: this.analyzeUserJourney(conversationHistory),
      questionType: this.classifyQuestionType(message),
      urgency: this.assessUrgency(message, sentiment),
      complexity: this.assessComplexity(message)
    };

    return context;
  }

  // Semantic Context Analysis
  analyzeSemanticContext(message, conversationHistory) {
    const messageLower = message.toLowerCase();
    
    // Define semantic categories for Fundobaba
    const semanticCategories = {
      loan_inquiry: {
        keywords: ['loan', 'borrow', 'money', 'amount', 'how much', 'get loan', 'need money', 'financial help'],
        context: 'user wants to know about loan options and amounts'
      },
      application_process: {
        keywords: ['apply', 'application', 'process', 'how to apply', 'steps', 'procedure', 'apply for loan'],
        context: 'user wants to understand the application process'
      },
      eligibility: {
        keywords: ['eligible', 'qualify', 'requirements', 'criteria', 'can i get', 'am i eligible', 'qualification'],
        context: 'user wants to check their eligibility'
      },
      documents: {
        keywords: ['documents', 'papers', 'kyc', 'pan', 'aadhaar', 'bank statement', 'salary slip', 'proof'],
        context: 'user wants to know about required documents'
      },
      repayment: {
        keywords: ['repay', 'payment', 'emi', 'installment', 'due date', 'pay back', 'repayment'],
        context: 'user wants to understand repayment terms'
      },
      interest_charges: {
        keywords: ['interest', 'rate', 'charges', 'fees', 'cost', 'how much interest', 'charges'],
        context: 'user wants to know about interest rates and charges'
      },
      company_info: {
        keywords: ['company', 'fundobaba', 'about', 'what is', 'legitimate', 'safe', 'trust'],
        context: 'user wants to know about the company'
      },
      support_contact: {
        keywords: ['contact', 'support', 'help', 'phone', 'email', 'customer service', 'human'],
        context: 'user wants to contact support'
      },
      technical_issues: {
        keywords: ['problem', 'issue', 'error', 'not working', 'technical', 'bug', 'trouble'],
        context: 'user is facing technical issues'
      },
      loan_status: {
        keywords: ['status', 'track', 'check', 'approved', 'disbursed', 'pending', 'rejected'],
        context: 'user wants to check loan status'
      }
    };

    // Find the best matching semantic category
    let bestCategory = null;
    let bestScore = 0;

    for (const [category, data] of Object.entries(semanticCategories)) {
      let score = 0;
      data.keywords.forEach(keyword => {
        if (messageLower.includes(keyword)) {
          score += 1;
        }
      });
      
      // Normalize score by number of keywords
      score = score / data.keywords.length;
      
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category;
      }
    }

    return {
      category: bestCategory,
      confidence: bestScore,
      context: bestCategory ? semanticCategories[bestCategory].context : 'general inquiry',
      relatedTopics: this.findRelatedTopics(message, conversationHistory)
    };
  }

  // Identify Conversation Topic
  identifyConversationTopic(conversationHistory) {
    if (conversationHistory.length === 0) return 'new_conversation';

    const recentMessages = conversationHistory.slice(-5);
    const topics = {
      loan_inquiry: 0,
      application: 0,
      documents: 0,
      repayment: 0,
      support: 0,
      technical: 0
    };

    recentMessages.forEach(msg => {
      const content = msg.content || msg;
      const context = this.analyzeSemanticContext(content, []);
      
      if (context.category) {
        topics[context.category] = (topics[context.category] || 0) + 1;
      }
    });

    // Find the most discussed topic
    const mainTopic = Object.entries(topics).reduce((a, b) => topics[a] > topics[b] ? a : b);
    
    return {
      primary: mainTopic,
      distribution: topics,
      consistency: Math.max(...Object.values(topics)) / recentMessages.length
    };
  }

  // Analyze User Journey
  analyzeUserJourney(conversationHistory) {
    if (conversationHistory.length === 0) return 'new_user';

    const journeyStages = {
      awareness: ['hello', 'hi', 'what is', 'about', 'company'],
      interest: ['loan', 'amount', 'how much', 'interest', 'charges'],
      consideration: ['apply', 'process', 'documents', 'eligibility', 'requirements'],
      application: ['apply now', 'start application', 'begin process'],
      post_application: ['status', 'track', 'approved', 'disbursed'],
      support: ['help', 'contact', 'problem', 'issue']
    };

    const userStage = this.determineUserStage(conversationHistory, journeyStages);
    
    return {
      stage: userStage,
      progression: this.analyzeProgression(conversationHistory),
      engagement: this.calculateEngagement(conversationHistory),
      needs: this.identifyUserNeeds(conversationHistory)
    };
  }

  // Determine User Stage
  determineUserStage(conversationHistory, journeyStages) {
    const recentMessages = conversationHistory.slice(-3);
    const stageScores = {};

    for (const [stage, keywords] of Object.entries(journeyStages)) {
      stageScores[stage] = 0;
      
      recentMessages.forEach(msg => {
        const content = (msg.content || msg).toLowerCase();
        keywords.forEach(keyword => {
          if (content.includes(keyword)) {
            stageScores[stage] += 1;
          }
        });
      });
    }

    return Object.entries(stageScores).reduce((a, b) => 
      stageScores[a[0]] > stageScores[b[0]] ? a : b
    )[0];
  }

  // Classify Question Type
  classifyQuestionType(message) {
    const questionTypes = {
      what: /^what\b/i,
      how: /^how\b/i,
      when: /^when\b/i,
      where: /^where\b/i,
      why: /^why\b/i,
      who: /^who\b/i,
      which: /^which\b/i,
      can: /^can\b/i,
      could: /^could\b/i,
      would: /^would\b/i,
      should: /^should\b/i,
      is: /^is\b/i,
      are: /^are\b/i,
      do: /^do\b/i,
      does: /^does\b/i
    };

    for (const [type, pattern] of Object.entries(questionTypes)) {
      if (pattern.test(message)) {
        return type;
      }
    }

    return 'statement';
  }

  // Assess Urgency
  assessUrgency(message, sentiment) {
    const urgentKeywords = ['urgent', 'emergency', 'asap', 'immediately', 'now', 'quick', 'fast', 'hurry'];
    const messageLower = message.toLowerCase();
    
    let urgencyScore = 0;
    urgentKeywords.forEach(keyword => {
      if (messageLower.includes(keyword)) {
        urgencyScore += 1;
      }
    });

    // Sentiment can also indicate urgency
    if (sentiment.score < -0.3) urgencyScore += 0.5;

    return {
      score: Math.min(urgencyScore, 1),
      level: urgencyScore > 0.7 ? 'high' : urgencyScore > 0.3 ? 'medium' : 'low'
    };
  }

  // Assess Complexity
  assessComplexity(message) {
    const words = message.split(/\s+/).length;
    const sentences = message.split(/[.!?]+/).length;
    const avgWordsPerSentence = words / sentences;
    
    return {
      wordCount: words,
      sentenceCount: sentences,
      avgWordsPerSentence: avgWordsPerSentence,
      complexity: avgWordsPerSentence > 15 ? 'high' : avgWordsPerSentence > 10 ? 'medium' : 'low'
    };
  }

  // Find Related Topics
  findRelatedTopics(message, conversationHistory) {
    const relatedTopics = {
      'loan_inquiry': ['application_process', 'eligibility', 'interest_charges'],
      'application_process': ['documents', 'eligibility', 'loan_inquiry'],
      'documents': ['kyc', 'application_process', 'eligibility'],
      'repayment': ['interest_charges', 'loan_inquiry'],
      'interest_charges': ['loan_inquiry', 'repayment'],
      'company_info': ['support_contact', 'loan_inquiry']
    };

    // Get current context without calling findRelatedTopics again
    const messageLower = message.toLowerCase();
    let currentCategory = null;
    
    // Simple category detection without recursion
    if (messageLower.includes('loan') || messageLower.includes('borrow') || messageLower.includes('money')) {
      currentCategory = 'loan_inquiry';
    } else if (messageLower.includes('apply') || messageLower.includes('process') || messageLower.includes('steps')) {
      currentCategory = 'application_process';
    } else if (messageLower.includes('documents') || messageLower.includes('papers') || messageLower.includes('kyc')) {
      currentCategory = 'documents';
    } else if (messageLower.includes('repay') || messageLower.includes('payment') || messageLower.includes('emi')) {
      currentCategory = 'repayment';
    } else if (messageLower.includes('interest') || messageLower.includes('rate') || messageLower.includes('charges')) {
      currentCategory = 'interest_charges';
    } else if (messageLower.includes('company') || messageLower.includes('fundobaba') || messageLower.includes('about')) {
      currentCategory = 'company_info';
    }

    return relatedTopics[currentCategory] || [];
  }

  // Analyze Progression
  analyzeProgression(conversationHistory) {
    if (conversationHistory.length < 2) return 'starting';

    const stages = ['awareness', 'interest', 'consideration', 'application', 'post_application'];
    const recentStages = conversationHistory.slice(-3).map(msg => 
      this.determineUserStage([msg], this.getJourneyStages())
    );

    // Check if user is progressing through stages
    const uniqueStages = [...new Set(recentStages)];
    const progression = uniqueStages.length > 1 ? 'progressing' : 'stuck';

    return {
      status: progression,
      stages: recentStages,
      direction: this.assessDirection(recentStages, stages)
    };
  }

  // Calculate Engagement
  calculateEngagement(conversationHistory) {
    const messageCount = conversationHistory.length;
    const avgMessageLength = conversationHistory.reduce((sum, msg) => 
      sum + (msg.content || msg).length, 0) / messageCount;
    
    const followUpQuestions = conversationHistory.filter((msg, index) => 
      index > 0 && this.classifyQuestionType(msg.content || msg) !== 'statement'
    ).length;

    return {
      messageCount: messageCount,
      avgMessageLength: avgMessageLength,
      followUpQuestions: followUpQuestions,
      engagement: messageCount > 5 ? 'high' : messageCount > 2 ? 'medium' : 'low'
    };
  }

  // Identify User Needs
  identifyUserNeeds(conversationHistory) {
    const needs = {
      information: 0,
      guidance: 0,
      support: 0,
      clarification: 0,
      reassurance: 0
    };

    conversationHistory.forEach(msg => {
      const content = (msg.content || msg).toLowerCase();
      const questionType = this.classifyQuestionType(content);
      
      if (questionType === 'what' || questionType === 'how') {
        needs.information += 1;
      } else if (questionType === 'can' || questionType === 'could') {
        needs.guidance += 1;
      } else if (content.includes('help') || content.includes('support')) {
        needs.support += 1;
      } else if (questionType === 'why' || content.includes('clarify')) {
        needs.clarification += 1;
      } else if (content.includes('safe') || content.includes('trust') || content.includes('legitimate')) {
        needs.reassurance += 1;
      }
    });

    return needs;
  }

  // Get Journey Stages Helper
  getJourneyStages() {
    return {
      awareness: ['hello', 'hi', 'what is', 'about', 'company'],
      interest: ['loan', 'amount', 'how much', 'interest', 'charges'],
      consideration: ['apply', 'process', 'documents', 'eligibility', 'requirements'],
      application: ['apply now', 'start application', 'begin process'],
      post_application: ['status', 'track', 'approved', 'disbursed'],
      support: ['help', 'contact', 'problem', 'issue']
    };
  }

  // Assess Direction
  assessDirection(recentStages, allStages) {
    if (recentStages.length < 2) return 'neutral';
    
    const stageIndices = recentStages.map(stage => allStages.indexOf(stage));
    const isProgressing = stageIndices.every((index, i) => 
      i === 0 || index >= stageIndices[i - 1]
    );
    
    return isProgressing ? 'forward' : 'backward';
  }

  // User Mood Analysis
  analyzeUserMood(sentiment, conversationHistory) {
    const recentSentiments = conversationHistory.slice(-5).map(msg => 
      this.analyzeSentiment(msg.content || msg)
    );

    const avgSentiment = recentSentiments.reduce((sum, s) => sum + s.score, 0) / recentSentiments.length;
    
    if (avgSentiment > 0.3) return 'positive';
    if (avgSentiment < -0.3) return 'negative';
    return 'neutral';
  }

  // Comprehensive Response Scoring System
  calculateResponseScore(userMessage, responsePatterns) {
    const messageLower = userMessage.toLowerCase();
    const scores = [];
    
    // Common words with lower weights
    const commonWords = {
      'the': 0.1, 'a': 0.1, 'an': 0.1, 'and': 0.1, 'or': 0.1, 'but': 0.1, 'in': 0.1, 'on': 0.1, 'at': 0.1, 'to': 0.1, 'for': 0.1, 'of': 0.1, 'with': 0.1, 'by': 0.1,
      'is': 0.2, 'are': 0.2, 'was': 0.2, 'were': 0.2, 'be': 0.2, 'been': 0.2, 'have': 0.2, 'has': 0.2, 'had': 0.2, 'do': 0.2, 'does': 0.2, 'did': 0.2,
      'will': 0.2, 'would': 0.2, 'could': 0.2, 'should': 0.2, 'may': 0.2, 'might': 0.2, 'can': 0.2,
      'this': 0.3, 'that': 0.3, 'these': 0.3, 'those': 0.3, 'i': 0.3, 'you': 0.3, 'he': 0.3, 'she': 0.3, 'it': 0.3, 'we': 0.3, 'they': 0.3, 'me': 0.3, 'him': 0.3, 'her': 0.3, 'us': 0.3, 'them': 0.3,
      'what': 0.4, 'how': 0.4, 'when': 0.4, 'where': 0.4, 'why': 0.4, 'who': 0.4, 'which': 0.4
    };
    
    // Important keywords with higher weights
    const importantKeywords = {
      'loan': 2.0, 'borrow': 2.0, 'money': 2.0, 'amount': 2.0, 'emi': 2.0, 'installment': 2.0,
      'apply': 1.8, 'application': 1.8, 'process': 1.8, 'steps': 1.8,
      'documents': 1.8, 'papers': 1.8, 'kyc': 1.8, 'pan': 1.8, 'aadhaar': 1.8, 'bank statement': 1.8,
      'repay': 1.8, 'payment': 1.8, 'repayment': 1.8, 'pay': 1.8,
      'interest': 1.8, 'rate': 1.8, 'charges': 1.8, 'fees': 1.8,
      'eligible': 1.8, 'eligibility': 1.8, 'qualify': 1.8, 'requirements': 1.8, 'criteria': 1.8,
      'max': 1.8, 'maximum': 1.8, 'highest': 1.8, 'min': 1.8, 'minimum': 1.8, 'lowest': 1.8,
      'salary': 1.8, 'income': 1.8, 'salary requirement': 1.8,
      'reloan': 1.8, 'another loan': 1.8, 'second loan': 1.8,
      'fundobaba': 1.5, 'company': 1.5, 'about': 1.5,
      'contact': 1.5, 'support': 1.5, 'help': 1.5, 'phone': 1.5, 'email': 1.5,
      'thank': 1.0, 'thanks': 1.0, 'appreciate': 1.0,
      'hello': 0.8, 'hi': 0.8, 'hey': 0.8, 'good morning': 0.8, 'good evening': 0.8,
      'bye': 0.8, 'goodbye': 0.8, 'see you': 0.8
    };
    
    responsePatterns.forEach((pattern, index) => {
      let totalScore = 0;
      let keywordCount = 0;
      
      // Check for exact matches first
      if (messageLower.includes(pattern.toLowerCase())) {
        totalScore += 3.0; // High score for exact match
        keywordCount++;
      }
      
      // Check for word matches with weights
      const messageWords = messageLower.split(/\s+/);
      const patternWords = pattern.toLowerCase().split(/\s+/);
      
      patternWords.forEach(word => {
        if (messageWords.includes(word)) {
          if (importantKeywords[word]) {
            totalScore += importantKeywords[word];
            keywordCount++;
          } else if (commonWords[word]) {
            totalScore += commonWords[word];
          } else {
            totalScore += 1.0; // Default weight for other words
            keywordCount++;
          }
        }
      });
      
      // Check for partial matches
      patternWords.forEach(word => {
        messageWords.forEach(msgWord => {
          if (msgWord.includes(word) || word.includes(msgWord)) {
            if (importantKeywords[word]) {
              totalScore += importantKeywords[word] * 0.7; // Partial match gets 70% of full score
            } else if (!commonWords[word]) {
              totalScore += 0.7; // Partial match for other words
            }
          }
        });
      });
      
      // Bonus for question words if it's a question
      if (messageLower.includes('what') || messageLower.includes('how') || messageLower.includes('why') || messageLower.includes('when') || messageLower.includes('where') || messageLower.includes('who') || messageLower.includes('which') || messageLower.includes('can') || messageLower.includes('could') || messageLower.includes('would') || messageLower.includes('should')) {
        totalScore += 0.5; // Bonus for questions
      }
      
      // Normalize score by keyword count to avoid bias towards longer patterns
      const normalizedScore = keywordCount > 0 ? totalScore / keywordCount : totalScore;
      
      scores.push({
        pattern: pattern,
        score: normalizedScore,
        totalScore: totalScore,
        keywordCount: keywordCount,
        index: index
      });
    });
    
    // Sort by score (highest first)
    scores.sort((a, b) => b.score - a.score);
    
    return scores;
  }

  // Enhanced Response Selection
  selectBestResponse(userMessage, responsePatterns, threshold = 0.5) {
    const scores = this.calculateResponseScore(userMessage, responsePatterns);
    
    console.log('🎯 Response Scores:', scores.map(s => `${s.pattern}: ${s.score.toFixed(2)}`));
    
    if (scores.length > 0 && scores[0].score >= threshold) {
      return {
        pattern: scores[0].pattern,
        score: scores[0].score,
        confidence: Math.min(scores[0].score / 3.0, 1.0), // Normalize confidence to 0-1
        allScores: scores
      };
    }
    
    return null;
  }

  // Language Detection
  detectLanguage(message) {
    // Simple language detection based on common words
    const hindiWords = ['namaste', 'dhanyavaad', 'kya', 'kaise', 'kahan'];
    const englishWords = ['hello', 'thank', 'loan', 'apply', 'help'];
    
    const hindiCount = hindiWords.filter(word => 
      message.toLowerCase().includes(word)
    ).length;
    
    const englishCount = englishWords.filter(word => 
      message.toLowerCase().includes(word)
    ).length;

    if (hindiCount > englishCount) return 'hindi';
    if (englishCount > hindiCount) return 'english';
    return 'mixed';
  }
}

module.exports = NLPService; 