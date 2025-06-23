const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');

// Load environment variables
dotenv.config({ path: './config.env' });

const app = express();
const server = http.createServer(app);

// Allow multiple origins from env (comma-separated)
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];

const corsOptions = {
  origin: allowedOrigins,
  methods: ['GET', 'POST'],
  credentials: true
};

// Socket.io with CORS
const io = socketIo(server, { cors: corsOptions });

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB successfully');
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Import routes
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const loanRoutes = require('./routes/loan');

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/loan', loanRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Fundobaba Chatbot API is running',
    timestamp: new Date().toISOString(),
    features: ['NLP Integration', 'Intent Recognition', 'Entity Extraction', 'Fuzzy Matching']
  });
});

// Socket.io events
io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);

  socket.on('join-chat', (userId) => {
    socket.join(`user-${userId}`);
    console.log(`User ${userId} joined their chat room`);
  });

  socket.on('send-message', (data) => {
    io.to(`user-${data.userId}`).emit('new-message', data);
  });

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    status: 'error',
    message: 'Something went wrong!'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found'
  });
});

// Start server
const PORT = process.env.PORT || 5004;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Fundobaba Chatbot Server running on port ${PORT}`);
});
