// Express API Server برای نمایش داده‌ها
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// راه‌اندازی ربات
let botProcess = null;
function startBot() {
  if (botProcess) {
    console.log('⚠️  ربات قبلاً در حال اجراست');
    return;
  }
  
  console.log('🚀 راه‌اندازی ربات...');
  botProcess = spawn('node', ['bot.js'], {
    stdio: 'inherit'
  });
  
  botProcess.on('error', (err) => {
    console.error('❌ خطا در اجرای ربات:', err);
    botProcess = null;
  });
  
  botProcess.on('exit', (code) => {
    console.log(`⚠️  ربات متوقف شد با کد: ${code}`);
    botProcess = null;
    // راه‌اندازی مجدد بعد از 5 ثانیه
    setTimeout(startBot, 5000);
  });
}

// خواندن داده‌ها
function readTradingData() {
  try {
    if (fs.existsSync('trading_data.json')) {
      return JSON.parse(fs.readFileSync('trading_data.json', 'utf8'));
    }
  } catch (err) {
    console.error('خطا در خواندن داده‌ها:', err.message);
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

// API Endpoints

// وضعیت کلی
app.get('/api/stats', (req, res) => {
  const data = readTradingData();
  const runningTime = Date.now() - data.stats.startTime;
  
  res.json({
    status: 'active',
    stats: {
      ...data.stats,
      runningTime,
      winRate: data.stats.totalTrades > 0 
        ? (data.stats.wins / data.stats.totalTrades * 100).toFixed(1) 
        : 0,
      roi: ((data.stats.capital - 10) / 10 * 100).toFixed(2),
    },
    activePositions: data.activePositions.length,
    totalTrades: data.trades.length,
    lastUpdate: data.lastUpdate,
  });
});

// لیست معاملات
app.get('/api/trades', (req, res) => {
  const data = readTradingData();
  res.json({
    trades: data.trades.slice(-100), // آخرین 100 معامله
    total: data.trades.length,
  });
});

// معاملات گروه‌بندی شده به ساعت
app.get('/api/trades/hourly', (req, res) => {
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
    hourlyData[hour].totalProfit += trade.profit;
    if (trade.status === 'win') hourlyData[hour].wins++;
    else hourlyData[hour].losses++;
  });
  
  res.json({
    hourly: Object.values(hourlyData).sort((a, b) => 
      new Date(b.hour) - new Date(a.hour)
    ),
  });
});

// پوزیشن‌های فعال
app.get('/api/positions', (req, res) => {
  const data = readTradingData();
  res.json({
    positions: data.activePositions,
    count: data.activePositions.length,
  });
});

// ریست کردن داده‌ها (فقط برای تست)
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
  res.json({ message: 'داده‌ها ریست شدند' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    botRunning: botProcess !== null,
  });
});

// صفحه اصلی
app.get('/', (req, res) => {
  res.json({
    message: 'Solana Trading Bot API',
    version: '1.0.0',
    endpoints: [
      'GET /api/stats - آمار کلی',
      'GET /api/trades - لیست معاملات',
      'GET /api/trades/hourly - معاملات ساعتی',
      'GET /api/positions - پوزیشن‌های فعال',
      'GET /health - وضعیت سلامت',
    ],
  });
});

// راه‌اندازی سرور
app.listen(PORT, () => {
  console.log(`\n✅ سرور API راه‌اندازی شد: http://localhost:${PORT}`);
  console.log(`📡 Endpoints آماده است`);
  
  // راه‌اندازی ربات
  startBot();
});

// مدیریت خطاها
process.on('uncaughtException', (err) => {
  console.error('❌ خطای غیرمنتظره:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Promise Rejection:', err);
});

// توقف درست هنگام بستن
process.on('SIGTERM', () => {
  console.log('⚠️  دریافت سیگنال SIGTERM، توقف درست...');
  if (botProcess) {
    botProcess.kill();
  }
  process.exit(0);
});
