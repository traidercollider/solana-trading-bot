// Express API Server with FULL CORS
const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS کامل
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Secret'],
  credentials: true
}));

app.options('*', cors());
app.use(express.json());

// خواندن داده‌ها
function readTradingData() {
  try {
    if (fs.existsSync('trading_data.json')) {
      return JSON.parse(fs.readFileSync('trading_data.json', 'utf8'));
    }
  } catch (err) {
    console.error('Error reading data:', err.message);
  }
  
  // داده‌های پیش‌فرض
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

// Middleware برای لاگ
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.path}`);
  next();
});

// API Endpoints

app.get('/api/stats', (req, res) => {
  try {
    const data = readTradingData();
    
    const response = {
      status: 'active',
      stats: {
        ...data.stats,
        winRate: data.stats.totalTrades > 0 
          ? (data.stats.wins / data.stats.totalTrades * 100).toFixed(1) 
          : '0',
        roi: ((data.stats.capital - 270) / 270 * 100).toFixed(2),
      },
      activePositions: data.activePositions.length,
      totalTrades: data.trades.length,
      lastUpdate: data.lastUpdate,
    };
    
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/trades/hourly', (req, res) => {
  try {
    const data = readTradingData();
    
    // استفاده از داده‌های شبیه‌سازی شده
    let hourlyData = data.simulatedData?.hourly || [];
    
    // اگر داده شبیه‌سازی شده نداریم، از داده واقعی استفاده می‌کنیم
    if (hourlyData.length === 0) {
      hourlyData = data.simulatedData.hourly;
    }
    
    const response = {
      hourly: hourlyData.slice(-24), // آخرین 24 ساعت
    };
    
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/trades', (req, res) => {
  try {
    const data = readTradingData();
    res.json({
      trades: data.trades.slice(-50),
      total: data.trades.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/positions', (req, res) => {
  try {
    const data = readTradingData();
    res.json({
      positions: data.activePositions,
      count: data.activePositions.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => {
  const data = readTradingData();
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    trades: data.trades.length,
    activePositions: data.activePositions.length,
    capital: data.stats.capital,
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Solana Trading Bot API - FIXED VERSION',
    version: '2.0.0',
    status: 'running',
    mode: 'simulation',
    endpoints: [
      'GET /api/stats',
      'GET /api/trades',
      'GET /api/trades/hourly', 
      'GET /api/positions',
      'GET /health',
    ],
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ سرور API: http://0.0.0.0:${PORT}`);
  console.log(`📡 CORS enabled for all origins`);
  console.log(`🚀 Bot running in simulation mode\n`);
});
