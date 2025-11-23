// SOLANA TRADING BOT - INFINITE MODE
// به‌روزرسانی: نوامبر 2024
// نسخه: 3.0.0 - بهینه شده برای اجرای بی‌نهایت

const fs = require('fs');
const path = require('path');

// =============================================
// CONFIGURATION
// =============================================

const CONFIG = {
  // Capital Settings
  INITIAL_CAPITAL: 270,           // سرمایه اولیه (دلار)
  POSITION_SIZE: 10,              // اندازه هر معامله (دلار)
  MAX_POSITIONS: 10,              // حداکثر پوزیشن همزمان
  
  // Trading Settings
  TAKE_PROFIT: 0.50,              // هدف سود (50%)
  STOP_LOSS: -0.30,               // حد ضرر (-30%)
  MAX_TOKEN_AGE: 120,             // حداکثر سن توکن (ثانیه)
  MIN_LIQUIDITY: 50,              // حداقل نقدینگی (دلار)
  
  // Timing Settings
  CHECK_INTERVAL: 500,            // فاصله چک کردن (0.5 ثانیه)
  SAVE_INTERVAL: 5000,            // فاصله ذخیره داده (5 ثانیه)
  REPORT_INTERVAL: 60000,         // فاصله گزارش (1 دقیقه)
  
  // Simulation Settings
  ENABLE_REAL_TRADING: false,     // فعال‌سازی معاملات واقعی
  SIMULATE_PRICE_VOLATILITY: true, // شبیه‌سازی نوسانات قیمت
  MIN_PRICE_CHANGE: -30,          // حداقل تغییر قیمت (%)
  MAX_PRICE_CHANGE: 100,          // حداکثر تغییر قیمت (%)
};

// =============================================
// GLOBAL STATE
// =============================================

let trades = [];
let activePositions = [];
let stats = {
  totalTrades: 0,
  wins: 0,
  losses: 0,
  totalProfit: 0,
  capital: CONFIG.INITIAL_CAPITAL,
  startTime: Date.now(),
  scannedTokens: 0,
  lastSaveTime: Date.now(),
  lastReportTime: Date.now(),
};

let scanCount = 0;
let shouldSave = false;

// =============================================
// FILE OPERATIONS
// =============================================

function saveData() {
  try {
    const data = {
      trades: trades.slice(-1000), // آخرین 1000 معامله
      activePositions,
      stats,
      lastUpdate: new Date().toISOString(),
      simulatedData: generateRecentSimulatedData()
    };
    
    const dataPath = path.join(__dirname, 'trading_data.json');
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    
    stats.lastSaveTime = Date.now();
    shouldSave = false;
    
    return true;
  } catch (err) {
    console.error('❌ Error saving data:', err.message);
    return false;
  }
}

function loadData() {
  try {
    const dataPath = path.join(__dirname, 'trading_data.json');
    
    if (fs.existsSync(dataPath)) {
      const rawData = fs.readFileSync(dataPath, 'utf8');
      const data = JSON.parse(rawData);
      
      trades = data.trades || [];
      activePositions = data.activePositions || [];
      stats = data.stats || stats;
      
      console.log(`✅ Loaded: ${trades.length} trades, ${activePositions.length} active positions`);
      console.log(`💰 Current Capital: $${stats.capital.toFixed(2)}`);
      return true;
    } else {
      console.log('⚠️  No previous data found - starting fresh');
      return false;
    }
  } catch (err) {
    console.error('❌ Error loading data:', err.message);
    return false;
  }
}

// =============================================
// SIMULATED DATA GENERATION
// =============================================

function generateRecentSimulatedData() {
  const hourlyData = [];
  const now = new Date();
  
  // تولید داده برای آخرین 24 ساعت
  for (let hoursAgo = 23; hoursAgo >= 0; hoursAgo--) {
    const hourDate = new Date(now.getTime() - (hoursAgo * 60 * 60 * 1000));
    const hourTrades = Math.floor(Math.random() * 8) + 2; // 2-10 معامله در ساعت
    
    const hourlyTrades = [];
    let hourTotalProfit = 0;
    let hourWins = 0;
    let hourLosses = 0;
    
    for (let i = 0; i < hourTrades; i++) {
      const isWin = Math.random() > 0.35; // 65% شانس برد
      const profitPercent = isWin 
        ? (Math.random() * 40) + 10    // 10% تا 50% سود
        : (Math.random() * 25) - 25;   // 0% تا -25% ضرر
      
      const profit = (CONFIG.POSITION_SIZE * profitPercent) / 100;
      
      hourlyTrades.push({
        symbol: `MEME${Math.floor(Math.random() * 10000)}`,
        token: `Token${Math.floor(Math.random() * 100000)}`,
        buyPrice: Math.random() * 0.01,
        sellPrice: Math.random() * 0.01 * (1 + profitPercent/100),
        profit: profit,
        profitPercent: profitPercent,
        reason: isWin ? '🎯 TARGET HIT' : '🛑 STOP LOSS'
      });
      
      hourTotalProfit += profit;
      if (isWin) hourWins++;
      else hourLosses++;
    }
    
    hourlyData.push({
      hour: hourDate.toLocaleString('fa-IR', { 
        weekday: 'long',
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      trades: hourlyTrades,
      totalProfit: hourTotalProfit,
      wins: hourWins,
      losses: hourLosses
    });
  }
  
  return { hourly: hourlyData };
}

// =============================================
// TOKEN DISCOVERY
// =============================================

async function getNewTokens() {
  // در حالت واقعی، اینجا از API واقعی استفاده می‌شود
  // برای مثال: Raydium API, Jupiter API, DexScreener API
  
  if (CONFIG.ENABLE_REAL_TRADING) {
    // TODO: Implement real token discovery
    // const response = await fetch('https://api.raydium.io/v2/main/pairs');
    // return processRealTokens(response);
    return [];
  }
  
  // شبیه‌سازی کشف توکن‌های جدید
  const shouldFindToken = Math.random() > 0.7; // 30% شانس پیدا کردن توکن
  
  if (!shouldFindToken) return [];
  
  const numTokens = Math.floor(Math.random() * 3) + 1; // 1-3 توکن
  const tokens = [];
  
  for (let i = 0; i < numTokens; i++) {
    const tokenId = Math.floor(Math.random() * 1000000);
    const token = {
      address: `mock_addr_${Date.now()}_${tokenId}`,
      symbol: `MEME${tokenId}`,
      name: `MemeToken ${tokenId}`,
      pairAddress: `pair_addr_${Date.now()}_${tokenId}`,
      price: Math.random() * 0.001,
      liquidity: 50 + (Math.random() * 500),
      age: Math.random() * 200, // 0-200 ثانیه
      createdAt: new Date().toISOString(),
    };
    
    tokens.push(token);
  }
  
  stats.scannedTokens += tokens.length;
  return tokens;
}

// =============================================
// TRADING LOGIC
// =============================================

function shouldBuy(token) {
  // بررسی شرایط خرید
  const isNew = token.age <= CONFIG.MAX_TOKEN_AGE;
  const hasLiquidity = token.liquidity >= CONFIG.MIN_LIQUIDITY;
  const notBought = !activePositions.some(p => p.pairAddress === token.pairAddress);
  const hasCapital = stats.capital >= CONFIG.POSITION_SIZE;
  const hasRoom = activePositions.length < CONFIG.MAX_POSITIONS;
  
  return isNew && hasLiquidity && notBought && hasCapital && hasRoom;
}

async function buy(token) {
  if (stats.capital < CONFIG.POSITION_SIZE) {
    console.log(`⚠️  Insufficient capital: $${stats.capital.toFixed(2)}`);
    return null;
  }
  
  const position = {
    id: `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    token: token.name,
    symbol: token.symbol,
    address: token.address,
    pairAddress: token.pairAddress,
    buyPrice: token.price,
    currentPrice: token.price,
    quantity: CONFIG.POSITION_SIZE / token.price,
    investedAmount: CONFIG.POSITION_SIZE,
    buyTime: new Date().toISOString(),
    checkCount: 0,
    maxProfit: 0,
    minProfit: 0,
  };
  
  activePositions.push(position);
  stats.capital -= CONFIG.POSITION_SIZE;
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🟢 BUY: ${position.symbol}`);
  console.log(`   Price: ${position.buyPrice.toFixed(8)} | Amount: $${CONFIG.POSITION_SIZE}`);
  console.log(`   💰 Remaining Capital: $${stats.capital.toFixed(2)}`);
  console.log(`   📊 Active Positions: ${activePositions.length}/${CONFIG.MAX_POSITIONS}`);
  console.log(`${'='.repeat(70)}\n`);
  
  shouldSave = true;
  return position;
}

async function checkSell() {
  if (activePositions.length === 0) return;
  
  for (let i = activePositions.length - 1; i >= 0; i--) {
    const pos = activePositions[i];
    pos.checkCount++;
    
    // شبیه‌سازی تغییر قیمت
    if (CONFIG.SIMULATE_PRICE_VOLATILITY) {
      const priceChangePercent = 
        CONFIG.MIN_PRICE_CHANGE + 
        (Math.random() * (CONFIG.MAX_PRICE_CHANGE - CONFIG.MIN_PRICE_CHANGE));
      
      pos.currentPrice = pos.buyPrice * (1 + priceChangePercent / 100);
    }
    
    // محاسبه سود/ضرر
    const currentValue = pos.quantity * pos.currentPrice;
    const profit = currentValue - pos.investedAmount;
    const profitPercent = (profit / pos.investedAmount) * 100;
    
    // به‌روزرسانی رکوردها
    if (profitPercent > pos.maxProfit) pos.maxProfit = profitPercent;
    if (profitPercent < pos.minProfit) pos.minProfit = profitPercent;
    
    let shouldSell = false;
    let sellReason = '';
    
    // بررسی شرایط فروش
    if (profitPercent >= CONFIG.TAKE_PROFIT * 100) {
      shouldSell = true;
      sellReason = `🎯 TAKE PROFIT: ${profitPercent.toFixed(1)}%`;
    } else if (profitPercent <= CONFIG.STOP_LOSS * 100) {
      shouldSell = true;
      sellReason = `🛑 STOP LOSS: ${profitPercent.toFixed(1)}%`;
    }
    
    if (shouldSell) {
      await sell(pos, profit, profitPercent, sellReason, i);
    }
  }
}

async function sell(position, profit, profitPercent, reason, index) {
  const duration = (Date.now() - new Date(position.buyTime)) / 1000;
  
  const trade = {
    ...position,
    sellPrice: position.currentPrice,
    sellTime: new Date().toISOString(),
    profit,
    profitPercent,
    duration,
    status: profit > 0 ? 'win' : 'loss',
    reason,
  };
  
  // به‌روزرسانی آمار
  trades.push(trade);
  stats.totalTrades++;
  stats.totalProfit += profit;
  stats.capital += position.quantity * position.currentPrice;
  
  if (profit > 0) {
    stats.wins++;
  } else {
    stats.losses++;
  }
  
  // لاگ معامله
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${profit > 0 ? '✅ WIN' : '❌ LOSS'}: ${position.symbol}`);
  console.log(`   ${reason}`);
  console.log(`   Buy: ${position.buyPrice.toFixed(8)} → Sell: ${position.currentPrice.toFixed(8)}`);
  console.log(`   💰 P/L: $${profit.toFixed(2)} (${profitPercent.toFixed(1)}%)`);
  console.log(`   ⏱️  Duration: ${duration.toFixed(0)}s | Checks: ${position.checkCount}`);
  console.log(`   📊 Max: ${position.maxProfit.toFixed(1)}% | Min: ${position.minProfit.toFixed(1)}%`);
  console.log(`   💵 New Capital: $${stats.capital.toFixed(2)}`);
  console.log(`${'='.repeat(70)}\n`);
  
  // حذف پوزیشن
  activePositions.splice(index, 1);
  shouldSave = true;
}

// =============================================
// REPORTING
// =============================================

function printReport() {
  const uptime = (Date.now() - stats.startTime) / 1000;
  const uptimeHours = (uptime / 3600).toFixed(1);
  const winRate = stats.totalTrades > 0 
    ? ((stats.wins / stats.totalTrades) * 100).toFixed(1)
    : 0;
  const roi = ((stats.capital - CONFIG.INITIAL_CAPITAL) / CONFIG.INITIAL_CAPITAL * 100).toFixed(2);
  const avgProfitPerTrade = stats.totalTrades > 0 
    ? (stats.totalProfit / stats.totalTrades).toFixed(2)
    : 0;
  
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`📊 PERFORMANCE REPORT - ${new Date().toLocaleString('fa-IR')}`);
  console.log(`${'═'.repeat(70)}`);
  console.log(`💰 Capital: $${stats.capital.toFixed(2)} | ROI: ${roi}%`);
  console.log(`📈 Total Profit: $${stats.totalProfit.toFixed(2)}`);
  console.log(`📊 Trades: ${stats.totalTrades} | Wins: ${stats.wins} | Losses: ${stats.losses}`);
  console.log(`🎯 Win Rate: ${winRate}% | Avg P/L: $${avgProfitPerTrade}`);
  console.log(`🔍 Scanned Tokens: ${stats.scannedTokens}`);
  console.log(`📦 Active Positions: ${activePositions.length}/${CONFIG.MAX_POSITIONS}`);
  console.log(`⏰ Uptime: ${uptimeHours}h | Scans: ${scanCount}`);
  console.log(`${'═'.repeat(70)}\n`);
  
  stats.lastReportTime = Date.now();
}

// =============================================
// MAIN LOOP
// =============================================

async function mainLoop() {
  try {
    scanCount++;
    
    // چک کردن پوزیشن‌های فعال
    if (activePositions.length > 0) {
      await checkSell();
    }
    
    // جستجوی توکن‌های جدید
    const canBuyMore = activePositions.length < CONFIG.MAX_POSITIONS;
    const hasCapital = stats.capital >= CONFIG.POSITION_SIZE;
    
    if (canBuyMore && hasCapital) {
      const tokens = await getNewTokens();
      
      if (tokens.length > 0) {
        for (const token of tokens) {
          if (shouldBuy(token)) {
            await buy(token);
            break; // فقط یک توکن در هر اسکن
          }
        }
      }
    }
    
    // ذخیره داده
    const timeSinceLastSave = Date.now() - stats.lastSaveTime;
    if (shouldSave && timeSinceLastSave >= CONFIG.SAVE_INTERVAL) {
      saveData();
    }
    
    // گزارش دوره‌ای
    const timeSinceLastReport = Date.now() - stats.lastReportTime;
    if (timeSinceLastReport >= CONFIG.REPORT_INTERVAL) {
      printReport();
    }
    
  } catch (err) {
    console.error('❌ Error in main loop:', err.message);
  }
}

// =============================================
// INITIALIZATION
// =============================================

async function initialize() {
  console.log('\n' + '═'.repeat(70));
  console.log('🚀 SOLANA TRADING BOT - INFINITE MODE');
  console.log('═'.repeat(70));
  console.log(`💰 Initial Capital: $${CONFIG.INITIAL_CAPITAL}`);
  console.log(`🎯 Take Profit: ${CONFIG.TAKE_PROFIT * 100}% | Stop Loss: ${CONFIG.STOP_LOSS * 100}%`);
  console.log(`📦 Position Size: $${CONFIG.POSITION_SIZE} | Max Positions: ${CONFIG.MAX_POSITIONS}`);
  console.log(`⏱️  Check Interval: ${CONFIG.CHECK_INTERVAL}ms`);
  console.log(`🔧 Mode: ${CONFIG.ENABLE_REAL_TRADING ? 'REAL TRADING' : 'SIMULATION'}`);
  console.log('═'.repeat(70) + '\n');
  
  // بارگذاری داده‌های قبلی
  loadData();
  
  // شروع حلقه اصلی
  console.log('✅ Bot started successfully!\n');
  
  setInterval(mainLoop, CONFIG.CHECK_INTERVAL);
  
  // ذخیره اولیه
  setTimeout(() => {
    saveData();
    printReport();
  }, 5000);
}

// =============================================
// GRACEFUL SHUTDOWN
// =============================================

function shutdown() {
  console.log('\n⚠️  Shutting down bot...');
  
  saveData();
  printReport();
  
  console.log('✅ Bot stopped gracefully.\n');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// =============================================
// START BOT
// =============================================

initialize().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
