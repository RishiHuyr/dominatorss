require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // For development
    methods: ["GET", "POST"]
  }
});

// Serve Static Frontend Files from root
app.use(express.static(path.join(__dirname, '..')));

app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET || 'openissue_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // false for localhost HTTP
}));

// Route Redirects
app.get('/', (req, res) => res.redirect('/index.html'));

// Set socket.io on app locally so routes can access it
app.set('io', io);

app.use('/auth', authRoutes);
app.use('/api', apiRoutes);

// Socket.io Real-time logic
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;

// Validate Environment Variables
const REQUIRED_ENV = ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GITHUB_CALLBACK_URL', 'SESSION_SECRET', 'MONGO_URI'];
const MISSING_ENV = REQUIRED_ENV.filter(key => !process.env[key]);

if (MISSING_ENV.length > 0) {
    console.error(`\x1b[41m\x1b[37m ❌ CRITICAL STARTUP ERROR: Missing Environment Variables \x1b[0m`);
    console.error(`Please configure the following in your .env file:`);
    MISSING_ENV.forEach(key => console.error(` - ${key}`));
    process.exit(1);
}

const startServer = () => {
    server.listen(PORT, () => {
        console.log(`🚀 Issue Analysis Server running on port ${PORT}`);
        console.log(`🔗 Callback URL: ${process.env.GITHUB_CALLBACK_URL}`);
    });
};

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('✅ Connected to MongoDB');
        startServer();
    })
    .catch((err) => {
        console.error('\x1b[33m⚠️ WARNING: Failed to connect to MongoDB. Persistence features (history, login) will be disabled. Check your IP whitelist / Atlas settings.\x1b[0m');
        console.error('❌ MongoDB Error:', err.message);
        // Start server anyway for front-end only / stateless features
        startServer();
    });
