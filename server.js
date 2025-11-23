// SOLANA TRADING BOT API SERVER - PROFESSIONAL v4.0
// Optimized for Cloudflare Worker Integration
// Deployed: https://trading-bot-l4sz.onrender.com

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_SECRET = process.env.API_SECRET || 'mySecretKey123';

// =============================================
// MIDDLEWARE
// =============================================

// CORS - Allow all origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Secret'],
  credentials: true
}));

app.options('*', cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Security middleware (optional authentication)
const authenticateAPI = (req, res, next) => {
  const apiSecret = req.headers['x-api-secret'];
  if (apiSecret && apiSecret !== API_SECRET) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Invalid API secret'
    });
  }
  next();
};

// =============================================
// DATA READING
// =============================================

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
  
  // Default structure
  return {
    trades: [],
    activePositions: [],
    stats: {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      totalProfit: 0,
      totalFees: 0,
      netProfit: 0,
      capital: 1000,
      initialCapital: 1000,
      startTime: Date.now(),
      scannedTokens: 0,
      rejectedTokens: 0,
      avgTradeTime: 0,
      roi: '0.00',
      winRate: '0.0',
      avgProfitPerTrade: '0.00',
      uptime: '0',
    },
    recentScans: [],
    performance: {
      last24h: { trades: 0, profit: 0, wins: 0, losses: 0 },
      hourly: []
    },
    lastUpdate: new Date().toISOString(),
    version: '4.0.0',
  };
}

// =============================================
// API ENDPOINTS
// =============================================

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Solana Memecoin Trading Bot API',
    version: '4.0.0',
    status: 'running',
    mode: 'simulation',
    blockchain: 'Solana',
    description: 'Professional automated memecoin trading system',
    endpoints: {
      stats: 'GET /api/stats - Complete bot statistics',
      trades: 'GET /api/trades - Recent trades history',
      positions: 'GET /api/positions - Active positions',
      performance: 'GET /api/performance - Performance analytics',
      scans: 'GET /api/scans - Recent token scans',
      health: 'GET /health - Server health check',
    },
    deployment: {
      server: 'https://trading-bot-l4sz.onrender.com',
      worker: 'https://trading-panel.traid-collider.workers.dev',
    },
    documentation: 'https://github.com/your-repo/solana-trading-bot',
    timestamp: new Date().toISOString(),
  });
});

// GET /api/stats - Complete Statistics
app.get('/api/stats', (req, res) => {
  try {
    const data = readTradingData();
    const stats = data.stats || {};
    
    const response = {
      status: 'active',
      blockchain: 'Solana',
      mode: 'simulation',
      stats: {
        capital: parseFloat(stats.capital) || 1000,
        initialCapital: parseFloat(stats.initialCapital) || 1000,
        netProfit: parseFloat(stats.netProfit) || 0,
        totalProfit: parseFloat(stats.totalProfit) || 0,
        totalFees: parseFloat(stats.totalFees) || 0,
        totalTrades: parseInt(stats.totalTrades) || 0,
        wins: parseInt(stats.wins) || 0,
        losses: parseInt(stats.losses) || 0,
        winRate: stats.winRate || '0.0',
        roi: stats.roi || '0.00',
        avgProfitPerTrade: stats.avgProfitPerTrade || '0.00',
        avgTradeTime: parseFloat(stats.avgTradeTime) || 0,
        scannedTokens: parseInt(stats.scannedTokens) || 0,
        rejectedTokens: parseInt(stats.rejectedTokens) || 0,
        uptime: stats.uptime || '0',
        startTime: stats.startTime || Date.now(),
      },
      bestTrade: stats.bestTrade || null,
      worstTrade: stats.worstTrade || null,
      activePositionsCount: (data.activePositions || []).length,
      totalTradesInHistory: (data.trades || []).length,
      lastUpdate: data.lastUpdate || new Date().toISOString(),
      version: data.version || '4.0.0',
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

// GET /api/trades - Trades History
app.get('/api/trades', (req, res) => {
  try {
    const data = readTradingData();
    const limit = parseInt(req.query.limit) || 50;
    const trades = (data.trades || []).slice(-limit).reverse();
    
    res.json({
      trades: trades,
      total: (data.trades || []).length,
      showing: trades.length,
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

// GET /api/trades/:id - Single Trade Details
app.get('/api/trades/:id', (req, res) => {
  try {
    const data = readTradingData();
    const trade = (data.trades || []).find(t => t.id === req.params.id);
    
    if (!trade) {
      return res.status(404).json({ 
        error: 'Trade not found',
        status: 'error'
      });
    }
    
    res.json({
      trade: trade,
      status: 'success'
    });
  } catch (err) {
    console.error('❌ Error in /api/trades/:id:', err.message);
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
    
    const enrichedPositions = positions.map(p => ({
      ...p,
      age: p.age || ((Date.now() - p.buyTime) / 1000).toFixed(1),
      profitPercent: p.profitPercent || 0,
      profit: p.profit || 0,
      status: p.profitPercent >= 0 ? 'winning' : 'losing',
    }));
    
    res.json({
      positions: enrichedPositions,
      count: enrichedPositions.length,
      totalInvested: enrichedPositions.reduce((sum, p) => sum + (p.investedAmount || 0), 0),
      totalCurrentValue: enrichedPositions.reduce((sum, p) => 
        sum + ((p.quantity || 0) * (p.currentPrice || 0)), 0
      ),
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

// GET /api/positions/:id - Single Position Details
app.get('/api/positions/:id', (req, res) => {
  try {
    const data = readTradingData();
    const position = (data.activePositions || []).find(p => p.id === req.params.id);
    
    if (!position) {
      return res.status(404).json({ 
        error: 'Position not found',
        status: 'error'
      });
    }
    
    res.json({
      position: {
        ...position,
        age: ((Date.now() - position.buyTime) / 1000).toFixed(1),
      },
      status: 'success'
    });
  } catch (err) {
    console.error('❌ Error in /api/positions/:id:', err.message);
    res.status(500).json({ 
      error: err.message,
      status: 'error' 
    });
  }
});

// GET /api/performance - Performance Analytics
app.get('/api/performance', (req, res) => {
  try {
    const data = readTradingData();
    const performance = data.performance || {
      last24h: { trades: 0, profit: 0, wins: 0, losses: 0 },
      hourly: []
    };
    
    res.json({
      performance: performance,
      summary: {
        last24hTrades: performance.last24h.trades || 0,
        last24hProfit: performance.last24h.profit || 0,
        last24hWins: performance.last24h.wins || 0,
        last24hLosses: performance.last24h.losses || 0,
        last24hWinRate: performance.last24h.trades > 0
          ? ((performance.last24h.wins / performance.last24h.trades) * 100).toFixed(1)
          : '0.0'
      },
      status: 'success'
    });
  } catch (err) {
    console.error('❌ Error in /api/performance:', err.message);
    res.status(500).json({ 
      error: err.message,
      status: 'error' 
    });
  }
});

// GET /api/scans - Recent Token Scans
app.get('/api/scans', (req, res) => {
  try {
    const data = readTradingData();
    const scans = data.recentScans || [];
    
    res.json({
      scans: scans,
      count: scans.length,
      status: 'success'
    });
  } catch (err) {
    console.error('❌ Error in /api/scans:', err.message);
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
    const dataPath = path.join(__dirname, 'trading_data.json');
    
    res.json({ 
      status: 'healthy',
      server: 'online',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2) + ' MB',
        total: (process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2) + ' MB',
      },
      data: {
        exists: fs.existsSync(dataPath),
        trades: (data.trades || []).length,
        activePositions: (data.activePositions || []).length,
        capital: data.stats?.capital || 1000,
        lastUpdate: data.lastUpdate,
      },
      endpoints: {
        stats: '/api/stats',
        trades: '/api/trades',
        positions: '/api/positions',
        performance: '/api/performance',
        scans: '/api/scans',
      }
    });
  } catch (err) {
    res.status(500).json({ 
      status: 'unhealthy',
      error: err.message 
    });
  }
});

// GET /api/summary - Quick Summary (for Workers)
app.get('/api/summary', (req, res) => {
  try {
    const data = readTradingData();
    const stats = data.stats || {};
    
    res.json({
      capital: parseFloat(stats.capital) || 1000,
      netProfit: parseFloat(stats.netProfit) || 0,
      roi: stats.roi || '0.00',
      totalTrades: parseInt(stats.totalTrades) || 0,
      winRate: stats.winRate || '0.0',
      activePositions: (data.activePositions || []).length,
      status: 'active',
      lastUpdate: data.lastUpdate || new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ 
      error: err.message,
      status: 'error' 
    });
  }
});

// =============================================
// ERROR HANDLERS
// =============================================

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Endpoint ${req.path} does not exist`,
    availableEndpoints: [
      '/',
      '/health',
      '/api/stats',
      '/api/trades',
      '/api/trades/:id',
      '/api/positions',
      '/api/positions/:id',
      '/api/performance',
      '/api/scans',
      '/api/summary',
    ]
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    status: 'error'
  });
});

// =============================================
// START SERVER
// =============================================

app.listen(PORT, '0.0.0.0', () => {
  console.log('\n' + '═'.repeat(80));
  console.log('🚀 SOLANA TRADING BOT API SERVER v4.0');
  console.log('═'.repeat(80));
  console.log(`✅ Server running: http://0.0.0.0:${PORT}`);
  console.log(`🔗 Public URL: https://trading-bot-l4sz.onrender.com`);
  console.log(`🌐 CORS: Enabled for all origins`);
  console.log(`🔒 API Secret: ${API_SECRET ? 'Configured' : 'Not set'}`);
  console.log(`🤖 Mode: Simulation`);
  console.log(`⛓️  Blockchain: Solana`);
  console.log(`📅 Started: ${new Date().toLocaleString()}`);
  console.log('═'.repeat(80));
  
  // Check data file
  const dataPath = path.join(__dirname, 'trading_data.json');
  if (fs.existsSync(dataPath)) {
    const data = readTradingData();
    console.log(`\n✅ trading_data.json found`);
    console.log(`📊 Loaded: ${(data.trades || []).length} trades, ${(data.activePositions || []).length} active positions`);
    console.log(`💰 Capital: $${(data.stats?.capital || 1000).toFixed(2)}`);
    console.log(`📈 ROI: ${data.stats?.roi || '0.00'}%`);
  } else {
    console.log(`\n⚠️  trading_data.json not found - will be created by bot`);
  }
  
  console.log('\n' + '═'.repeat(80));
  console.log('📡 API Endpoints Ready:');
  console.log(`   GET  /              - API Information`);
  console.log(`   GET  /health        - Health Check`);
  console.log(`   GET  /api/stats     - Complete Statistics`);
  console.log(`   GET  /api/trades    - Trades History`);
  console.log(`   GET  /api/positions - Active Positions`);
  console.log(`   GET  /api/performance - Performance Analytics`);
  console.log(`   GET  /api/scans     - Recent Scans`);
  console.log(`   GET  /api/summary   - Quick Summary`);
  console.log('═'.repeat(80) + '\n');
});

// =============================================
// GRACEFUL SHUTDOWN
// =============================================

process.on('SIGTERM', () => {
  console.log('\n⚠️  SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n⚠️  SIGINT received, shutting down gracefully...');
  process.exit(0);
});

module.exports = app;
