// SOLANA TRADING BOT API SERVER - PROFESSIONAL v4.0
// با رابط کاربری کامل

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

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Secret'],
  credentials: true
}));

app.options('*', cors());
app.use(express.json());

app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - ${req.ip}`);
  next();
});

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
// DASHBOARD HTML
// =============================================

function getDashboardHTML() {
  return `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>پنل معاملاتی سولانا - داشبورد</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700&display=swap');
        
        :root {
            --primary: #667eea;
            --secondary: #764ba2;
            --success: #10b981;
            --danger: #ef4444;
            --warning: #f59e0b;
            --dark: #1f2937;
            --light: #f8fafc;
            --border: #e5e7eb;
        }
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Vazirmatn', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: white;
        }
        
        .header {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            padding: 20px 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .header h1 {
            font-size: 24px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .btn {
            padding: 10px 20px;
            border-radius: 8px;
            border: none;
            cursor: pointer;
            font-family: 'Vazirmatn', sans-serif;
            font-weight: 600;
            transition: all 0.3s;
            background: rgba(255, 255, 255, 0.2);
            color: white;
        }
        
        .btn:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: translateY(-2px);
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 30px;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .stat-card {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            padding: 25px;
            border-radius: 16px;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .stat-icon {
            width: 50px;
            height: 50px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 15px;
            font-size: 24px;
            background: rgba(255, 255, 255, 0.2);
        }
        
        .stat-value {
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 5px;
        }
        
        .stat-label {
            color: rgba(255, 255, 255, 0.8);
            font-size: 14px;
        }
        
        .card {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 16px;
            margin-bottom: 30px;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .card-header {
            padding: 20px 25px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .card-title {
            font-size: 18px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
        }
        
        th {
            padding: 15px 20px;
            text-align: right;
            font-weight: 600;
            background: rgba(255, 255, 255, 0.05);
        }
        
        td {
            padding: 15px 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        tbody tr:hover {
            background: rgba(255, 255, 255, 0.05);
        }
        
        .profit-positive { color: #10b981; font-weight: 700; }
        .profit-negative { color: #ef4444; font-weight: 700; }
        
        .token-img {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            margin-left: 10px;
            vertical-align: middle;
        }
        
        .loading {
            text-align: center;
            padding: 40px;
            color: rgba(255, 255, 255, 0.7);
        }
        
        .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid rgba(255, 255, 255, 0.2);
            border-left: 4px solid white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 15px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: rgba(255, 255, 255, 0.6);
        }
        
        .empty-state i {
            font-size: 60px;
            margin-bottom: 20px;
            opacity: 0.5;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1><i class="fas fa-robot"></i> پنل معاملاتی سولانا</h1>
        <button class="btn" onclick="loadData()">
            <i class="fas fa-sync-alt"></i> بروزرسانی
        </button>
    </div>
    
    <div class="container">
        <div class="stats-grid" id="statsGrid">
            <div class="loading"><div class="spinner"></div>در حال بارگذاری...</div>
        </div>
        
        <div class="card">
            <div class="card-header">
                <h3 class="card-title"><i class="fas fa-wallet"></i> پوزیشن‌های فعال</h3>
                <span id="positionsCount">0</span>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>توکن</th>
                            <th>قیمت خرید</th>
                            <th>قیمت فعلی</th>
                            <th>سود/ضرر</th>
                            <th>مدت</th>
                        </tr>
                    </thead>
                    <tbody id="positionsBody">
                        <tr><td colspan="5" class="loading">در حال بارگذاری...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
        
        <div class="card">
            <div class="card-header">
                <h3 class="card-title"><i class="fas fa-history"></i> آخرین معاملات</h3>
                <span id="tradesCount">0</span>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>توکن</th>
                            <th>قیمت خرید</th>
                            <th>قیمت فروش</th>
                            <th>سود/ضرر</th>
                            <th>دلیل</th>
                        </tr>
                    </thead>
                    <tbody id="tradesBody">
                        <tr><td colspan="5" class="loading">در حال بارگذاری...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <script>
        async function loadData() {
            await Promise.all([loadStats(), loadPositions(), loadTrades()]);
        }
        
        async function loadStats() {
            try {
                const res = await fetch('/api/stats');
                const data = await res.json();
                const s = data.stats || {};
                
                document.getElementById('statsGrid').innerHTML = \`
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-wallet"></i></div>
                        <div class="stat-value">$\${s.capital?.toFixed(2) || '0'}</div>
                        <div class="stat-label">سرمایه کل</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-chart-line"></i></div>
                        <div class="stat-value \${s.netProfit >= 0 ? 'profit-positive' : 'profit-negative'}">$\${s.netProfit?.toFixed(2) || '0'}</div>
                        <div class="stat-label">سود خالص</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-percentage"></i></div>
                        <div class="stat-value">\${s.winRate || '0'}%</div>
                        <div class="stat-label">نرخ برد</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-exchange-alt"></i></div>
                        <div class="stat-value">\${s.totalTrades || 0}</div>
                        <div class="stat-label">معاملات</div>
                    </div>
                \`;
            } catch (err) {
                console.error(err);
            }
        }
        
        async function loadPositions() {
            try {
                const res = await fetch('/api/positions');
                const data = await res.json();
                const positions = data.positions || [];
                
                document.getElementById('positionsCount').textContent = positions.length;
                
                if (positions.length === 0) {
                    document.getElementById('positionsBody').innerHTML = 
                        '<tr><td colspan="5" class="empty-state"><i class="fas fa-inbox"></i><br>هیچ پوزیشن فعالی وجود ندارد<br><small>ربات در حال جستجوی فرصت‌های معاملاتی است...</small></td></tr>';
                    return;
                }
                
                document.getElementById('positionsBody').innerHTML = positions.map(p => \`
                    <tr>
                        <td>
                            <img src="\${p.image || ''}" class="token-img" onerror="this.style.display='none'">
                            <strong>\${p.symbol}</strong><br>
                            <small style="color: rgba(255,255,255,0.6)">\${p.name}</small>
                        </td>
                        <td>$\${p.buyPrice?.toFixed(10) || '0'}</td>
                        <td>$\${p.currentPrice?.toFixed(10) || '0'}</td>
                        <td class="\${p.profit >= 0 ? 'profit-positive' : 'profit-negative'}">
                            $\${p.profit?.toFixed(2) || '0'} (\${p.profitPercent?.toFixed(1) || '0'}%)
                        </td>
                        <td>\${p.age || '0'}s</td>
                    </tr>
                \`).join('');
            } catch (err) {
                console.error(err);
            }
        }
        
        async function loadTrades() {
            try {
                const res = await fetch('/api/trades?limit=20');
                const data = await res.json();
                const trades = data.trades || [];
                
                document.getElementById('tradesCount').textContent = data.total || 0;
                
                if (trades.length === 0) {
                    document.getElementById('tradesBody').innerHTML = 
                        '<tr><td colspan="5" class="empty-state"><i class="fas fa-history"></i><br>هیچ معامله‌ای انجام نشده</td></tr>';
                    return;
                }
                
                document.getElementById('tradesBody').innerHTML = trades.map(t => \`
                    <tr>
                        <td>
                            <img src="\${t.image || ''}" class="token-img" onerror="this.style.display='none'">
                            <strong>\${t.symbol}</strong><br>
                            <small style="color: rgba(255,255,255,0.6)">\${t.name}</small>
                        </td>
                        <td>$\${t.buyPrice?.toFixed(10) || '0'}</td>
                        <td>$\${t.sellPrice?.toFixed(10) || '0'}</td>
                        <td class="\${t.netProfit >= 0 ? 'profit-positive' : 'profit-negative'}">
                            $\${t.netProfit?.toFixed(2) || '0'} (\${t.profitPercent?.toFixed(1) || '0'}%)
                        </td>
                        <td><small>\${t.reason || 'انجام شد'}</small></td>
                    </tr>
                \`).join('');
            } catch (err) {
                console.error(err);
            }
        }
        
        // Auto refresh every 3 seconds
        setInterval(loadData, 3000);
        
        // Initial load
        loadData();
    </script>
</body>
</html>`;
}

// =============================================
// ROUTES
// =============================================

// Root - Dashboard
app.get('/', (req, res) => {
  res.send(getDashboardHTML());
});

// API Info
app.get('/api', (req, res) => {
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
    timestamp: new Date().toISOString(),
  });
});

// GET /api/stats
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
    res.status(500).json({ error: err.message, status: 'error' });
  }
});

// GET /api/trades
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
    res.status(500).json({ error: err.message, status: 'error' });
  }
});

// GET /api/positions
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
      status: 'success'
    });
  } catch (err) {
    res.status(500).json({ error: err.message, status: 'error' });
  }
});

// GET /api/performance
app.get('/api/performance', (req, res) => {
  try {
    const data = readTradingData();
    const performance = data.performance || {
      last24h: { trades: 0, profit: 0, wins: 0, losses: 0 },
      hourly: []
    };
    
    res.json({
      performance: performance,
      status: 'success'
    });
  } catch (err) {
    res.status(500).json({ error: err.message, status: 'error' });
  }
});

// GET /api/scans
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
    res.status(500).json({ error: err.message, status: 'error' });
  }
});

// GET /health
app.get('/health', (req, res) => {
  try {
    const data = readTradingData();
    const dataPath = path.join(__dirname, 'trading_data.json');
    
    res.json({ 
      status: 'healthy',
      server: 'online',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      data: {
        exists: fs.existsSync(dataPath),
        trades: (data.trades || []).length,
        activePositions: (data.activePositions || []).length,
        capital: data.stats?.capital || 1000,
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'unhealthy', error: err.message });
  }
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Endpoint ${req.path} does not exist`
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
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
  console.log(`🌐 CORS: Enabled`);
  console.log(`📅 Started: ${new Date().toLocaleString()}`);
  console.log('═'.repeat(80) + '\n');
});

process.on('SIGTERM', () => {
  console.log('\n⚠️ SIGTERM received, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n⚠️ SIGINT received, shutting down...');
  process.exit(0);
});

module.exports = app;
