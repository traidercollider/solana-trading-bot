// Express API Server - COMPLETE FINAL VERSION
// به‌روزرسانی: نوامبر 2024
// نسخه: 3.0.0

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS Configuration - Full Access
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Secret'],
  credentials: true
}));

app.options('*', cors());
app.use(express.json());

// Logging Middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Read trading data from JSON file
function readTradingData() {
  try {
    const dataPath = path.join(__dirname, 'trading_data.json');
    
    if (fs.existsSync(dataPath)) {
      const rawData = fs.readFileSync(dataPath, 'utf8');
      const data = JSON.parse(rawData);
      return data;
    }
  } catch (err) {
    console.error('❌ Error reading trading data:', err.message);
  }
  
  // Return default data structure if file doesn't exist or error occurs
  return {
    trades: [],
    activePositions: [],
    stats: {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      totalProfit: 0,
      capital: 270,
      startTime: Date.now(),
      scannedTokens: 0,
    },
    lastUpdate: new Date().toISOString(),
    simulatedData: {
      hourly: []
    }
  };
}

// API Endpoints

// GET /api/stats - Bot Statistics
app.get('/api/stats', (req, res) => {
  try {
    const data = readTradingData();
    const stats = data.stats || {};
    
    const totalTrades = stats.totalTrades || 0;
    const wins = stats.wins || 0;
    const losses = stats.losses || 0;
    
    const winRate = totalTrades > 0 
      ? ((wins / totalTrades) * 100).toFixed(1)
      : '0.0';
    
    const roi = stats.capital && stats.capital !== 270
      ? (((stats.capital - 270) / 270) * 100).toFixed(2)
      : '0.00';
    
    const response = {
      status: 'active',
      stats: {
        totalTrades: totalTrades,
        wins: wins,
        losses: losses,
        totalProfit: stats.totalProfit || 0,
        capital: stats.capital || 270,
        startTime: stats.startTime || Date.now(),
        scannedTokens: stats.scannedTokens || 0,
        winRate: winRate,
        roi: roi,
      },
      activePositions: (data.activePositions || []).length,
      totalTrades: (data.trades || []).length,
      lastUpdate: data.lastUpdate || new Date().toISOString(),
    };
    
    res.json(response);
  } catch (err) {
    console.error('❌ Error in /api/stats:', err.message);
    res.status(500).json({ 
      error: err.message,
      status: 'error' 
    });
  }
});

// GET /api/trades/hourly - Hourly Trading Data
app.get('/api/trades/hourly', (req, res) => {
  try {
    const data = readTradingData();
    const hourlyData = data.simulatedData?.hourly || [];
    
    res.json({
      hourly: hourlyData.slice(-24), // Last 24 hours
      total: hourlyData.length,
      status: 'success'
    });
  } catch (err) {
    console.error('❌ Error in /api/trades/hourly:', err.message);
    res.status(500).json({ 
      error: err.message,
      status: 'error' 
    });
  }
});

// GET /api/trades - All Trades
app.get('/api/trades', (req, res) => {
  try {
    const data = readTradingData();
    const trades = data.trades || [];
    
    res.json({
      trades: trades.slice(-50), // Last 50 trades
      total: trades.length,
      status: 'success'
    });
  } catch (err) {
    console.error('❌ Error in /api/trades:', err.message);
    res.status(500).json({ 
      error: err.message,
      status: 'error' 
    });
  }
});

// GET /api/positions - Active Positions
app.get('/api/positions', (req, res) => {
  try {
    const data = readTradingData();
    const positions = data.activePositions || [];
    
    res.json({
      positions: positions,
      count: positions.length,
      status: 'success'
    });
  } catch (err) {
    console.error('❌ Error in /api/positions:', err.message);
    res.status(500).json({ 
      error: err.message,
      status: 'error' 
    });
  }
});

// GET /health - Health Check
app.get('/health', (req, res) => {
  try {
    const data = readTradingData();
    
    res.json({ 
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      stats: {
        trades: (data.trades || []).length,
        activePositions: (data.activePositions || []).length,
        capital: data.stats?.capital || 270,
      }
    });
  } catch (err) {
    res.status(500).json({ 
      status: 'error',
      error: err.message 
    });
  }
});

// GET / - API Info
app.get('/', (req, res) => {
  res.json({
    name: 'Solana Trading Bot API',
    version: '3.0.0',
    status: 'running',
    mode: 'simulation',
    description: 'Automated Memecoin Trading Bot for Solana Blockchain',
    endpoints: {
      stats: 'GET /api/stats - Bot statistics and performance',
      trades: 'GET /api/trades - Recent trades history',
      hourly: 'GET /api/trades/hourly - Hourly trading data',
      positions: 'GET /api/positions - Active positions',
      health: 'GET /health - Health check',
    },
    documentation: 'https://github.com/your-repo/trading-bot',
    timestamp: new Date().toISOString(),
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Endpoint ${req.path} does not exist`,
    availableEndpoints: [
      '/api/stats',
      '/api/trades',
      '/api/trades/hourly',
      '/api/positions',
      '/health'
    ]
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    status: 'error'
  });
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 SOLANA TRADING BOT API SERVER');
  console.log('='.repeat(60));
  console.log(`✅ Server running on: http://0.0.0.0:${PORT}`);
  console.log(`📡 CORS: Enabled for all origins`);
  console.log(`🤖 Mode: Simulation`);
  console.log(`⏰ Started at: ${new Date().toLocaleString('fa-IR')}`);
  console.log('='.repeat(60) + '\n');
  
  // Check if trading_data.json exists
  const dataPath = path.join(__dirname, 'trading_data.json');
  if (fs.existsSync(dataPath)) {
    console.log('✅ trading_data.json found');
    const data = readTradingData();
    console.log(`📊 Loaded: ${data.trades?.length || 0} trades, ${data.activePositions?.length || 0} active positions`);
  } else {
    console.log('⚠️  trading_data.json not found - will be created by bot');
  }
  
  console.log('');
});

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('\n⚠️  SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n⚠️  SIGINT received, shutting down gracefully...');
  process.exit(0);
});

module.exports = app;
