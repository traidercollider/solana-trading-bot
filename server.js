// Express API Server with FULL CORS
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS کامل - همه درخواست‌ها مجاز
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Secret'],
  credentials: true
}));

// Pre-flight برای OPTIONS
app.options('*', cors());

app.use(express.json());

// راه‌اندازی ربات
let botProcess = null;
function startBot() {
  if (botProcess) {
    console.log('⚠️ ربات قبلاً در حال اجراست');
    return;
  }
  
  console.log('🚀 راه‌اندازی ربات...');
  botProcess = spawn('node', ['bot.js'], {
    stdio: 'inherit'
  });
  
  botProcess.on('error', (err) => {
    console.error('❌ خطای ربات:', err);
    botProcess = null;
  });
  
  botProcess.on('exit', (code) => {
    console.log(`⚠️ ربات متوقف شد: ${code}`);
    botProcess = null;
    setTimeout(startBot, 5000);
  });
}

// خواندن داده‌ها
function readTradingData() {
  try {
    if (fs.existsSync('trading_data.json')) {
      const data = JSON.parse(fs.readFileSync('trading_data.json', 'utf8'));
      console.log(`📊 Data loaded: ${data.trades?.length || 0} trades, ${data.activePositions?.length || 0} positions`);
      return data;
    }
  } catch (err) {
    console.error('خطا در خواندن:', err.message);
  }
  return {
    trades: [],
    activePositions: [],
    stats: {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      totalProfit: 0,
      capital: 10,
      startTime: Date.now(),
    },
    lastUpdate: new Date().toISOString(),
  };
}

// Middleware برای لاگ
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'}`);
  next();
});

// API Endpoints

app.get('/api/stats', (req, res) => {
  try {
    const data = readTradingData();
    const runningTime = Date.now() - (data.stats.startTime || Date.now());
    
    const response = {
      status: 'active',
      stats: {
        ...data.stats,
        runningTime,
        winRate: data.stats.totalTrades > 0 
          ? (data.stats.wins / data.stats.totalTrades * 100).toFixed(1) 
          : '0',
        roi: ((data.stats.capital - 10) / 10 * 100).toFixed(2),
      },
      activePositions: data.activePositions.length,
      totalTrades: data.trades.length,
      lastUpdate: data.lastUpdate,
    };
    
    console.log('✅ Stats sent:', JSON.stringify(response).substring(0, 100));
    
    res.json(response);
  } catch (err) {
    console.error('❌ Stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/trades', (req, res) => {
  try {
    const data = readTradingData();
    res.json({
      trades: data.trades.slice(-100),
      total: data.trades.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/trades/hourly', (req, res) => {
  try {
    const data = readTradingData();
    const hourlyData = {};
    
    data.trades.forEach(trade => {
      const date = new Date(trade.buyTime);
      const hour = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
      
      if (!hourlyData[hour]) {
        hourlyData[hour] = {
          hour,
          trades: [],
          totalProfit: 0,
          wins: 0,
          losses: 0,
        };
      }
      
      hourlyData[hour].trades.push(trade);
      hourlyData[hour].totalProfit += trade.profit || 0;
      if (trade.status === 'win') hourlyData[hour].wins++;
      else hourlyData[hour].losses++;
    });
    
    const response = {
      hourly: Object.values(hourlyData).sort((a, b) => 
        new Date(b.hour) - new Date(a.hour)
      ),
    };
    
    console.log('✅ Hourly sent:', response.hourly.length, 'hours');
    
    res.json(response);
  } catch (err) {
    console.error('❌ Hourly error:', err);
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

app.post('/api/reset', (req, res) => {
  const secret = req.headers['x-api-secret'];
  if (secret !== process.env.VPS_API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const initialData = {
    trades: [],
    activePositions: [],
    stats: {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      totalProfit: 0,
      capital: 10,
      startTime: Date.now(),
    },
    lastUpdate: new Date().toISOString(),
  };
  
  fs.writeFileSync('trading_data.json', JSON.stringify(initialData, null, 2));
  res.json({ message: 'ریست شد' });
});

app.get('/health', (req, res) => {
  const data = readTradingData();
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    botRunning: botProcess !== null,
    trades: data.trades.length,
    activePositions: data.activePositions.length,
    capital: data.stats.capital,
  });
});

app.get('/', (req, res) => {
  const data = readTradingData();
  res.json({
    message: 'Solana Trading Bot API',
    version: '2.0.0',
    status: 'running',
    stats: {
      trades: data.trades.length,
      activePositions: data.activePositions.length,
      capital: data.stats.capital,
      totalProfit: data.stats.totalProfit,
    },
    endpoints: [
      'GET /api/stats',
      'GET /api/trades',
      'GET /api/trades/hourly',
      'GET /api/positions',
      'GET /health',
    ],
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ error: err.message });
});

// راه‌اندازی
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ سرور API: http://0.0.0.0:${PORT}`);
  console.log(`📡 CORS enabled for all origins`);
  console.log(`🚀 Starting bot...\n`);
  startBot();
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Rejection:', err);
});

process.on('SIGTERM', () => {
  console.log('⚠️ SIGTERM received');
  if (botProcess) botProcess.kill();
  process.exit(0);
});
