// 🚀 INSTANT BUY BOT - خرید فوری توکن‌های جدید
const fetch = require('node-fetch');
const fs = require('fs');

const CONFIG = {
  INITIAL_CAPITAL: 270, // سرمایه اولیه 270 دلار
  TAKE_PROFIT: 0.50, // 50% سود
  CHECK_INTERVAL: 2000, // 2 ثانیه - کاهش فرکانس برای جلوگیری از Rate Limit
  
  // شرایط خرید ساده‌تر
  MAX_TOKEN_AGE: 120, // 2 دقیقه برای تست
  MIN_LIQUIDITY: 50, // حداقل 50$ نقدینگی
  POSITION_SIZE: 10, // هر بار 10 دلار خرید
  MAX_POSITIONS: 10, // حداکثر 10 پوزیشن همزمان
};

// داده‌های شبیه‌سازی شده برای تست
let trades = [];
let activePositions = [];
let scannedTokens = 0;

let stats = {
  totalTrades: 0,
  wins: 0,
  losses: 0,
  totalProfit: 0,
  capital: CONFIG.INITIAL_CAPITAL,
  startTime: Date.now(),
  scannedTokens: 0,
};

function saveData() {
  const data = {
    trades,
    activePositions, 
    stats,
    lastUpdate: new Date().toISOString(),
    // داده‌های شبیه‌سازی شده برای نمایش
    simulatedData: generateSimulatedData()
  };
  
  fs.writeFileSync('trading_data.json', JSON.stringify(data, null, 2));
}

// تولید داده‌های شبیه‌سازی شده برای یک هفته
function generateSimulatedData() {
  const hourlyData = [];
  const days = ['یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];
  const baseDate = new Date('2024-10-22');
  
  for (let day = 0; day < 7; day++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + day);
    
    const dayName = days[day];
    const tradesCount = Math.floor(Math.random() * 10) + 20; // 20-30 معامله در روز
    const profitPercent = (Math.random() * 40) + 10; // 10-50% سود
    
    for (let hour = 0; hour < 24; hour++) {
      const hourTrades = Math.floor(Math.random() * 5) + 1; // 1-6 معامله در ساعت
      const hourProfit = (Math.random() * 0.1) - 0.02; // -2% تا +8% سود در ساعت
      
      const trades = [];
      for (let i = 0; i < hourTrades; i++) {
        const profit = Math.random() > 0.6 ? (Math.random() * 15) + 5 : (Math.random() * 10) - 5;
        trades.push({
          symbol: `MEME${Math.floor(Math.random() * 1000)}`,
          token: `Token${Math.floor(Math.random() * 10000)}`,
          buyPrice: Math.random() * 0.01,
          sellPrice: Math.random() * 0.01 * (1 + profit/100),
          profit: profit,
          profitPercent: profit,
          reason: profit > 0 ? '🎯 TARGET HIT' : '🛑 STOP LOSS'
        });
      }
      
      hourlyData.push({
        hour: `${dayName} ${date.getDate()} اکتبر ${hour}:00`,
        trades: trades,
        totalProfit: trades.reduce((sum, t) => sum + t.profit, 0),
        wins: trades.filter(t => t.profit > 0).length,
        losses: trades.filter(t => t.profit <= 0).length
      });
    }
  }
  
  return { hourly: hourlyData };
}

function loadData() {
  try {
    if (fs.existsSync('trading_data.json')) {
      const data = JSON.parse(fs.readFileSync('trading_data.json', 'utf8'));
      trades = data.trades || [];
      activePositions = data.activePositions || [];
      stats = data.stats || stats;
      console.log(`✅ Loaded: ${trades.length} trades, ${activePositions.length} active`);
    }
  } catch (err) {
    console.log('⚠️ Fresh start - using simulated data');
  }
}

async function getNewTokens() {
  // شبیه‌سازی دریافت توکن‌های جدید
  const tokens = [];
  const now = Date.now();
  
  try {
    // در حالت تست، توکن‌های شبیه‌سازی شده تولید می‌کنیم
    const mockTokens = [
      {
        address: 'mock1_' + Date.now(),
        symbol: 'TEST1',
        name: 'Test Token 1',
        pairAddress: 'pair1_' + Date.now(),
        price: 0.0001,
        liquidity: 150,
        age: 1.5,
        createdAt: new Date().toISOString(),
      },
      {
        address: 'mock2_' + Date.now(),
        symbol: 'TEST2', 
        name: 'Test Token 2',
        pairAddress: 'pair2_' + Date.now(),
        price: 0.0002,
        liquidity: 200,
        age: 0.8,
        createdAt: new Date().toISOString(),
      }
    ];
    
    return mockTokens;
  } catch (err) {
    console.error('⚠️ API Error:', err.message);
    return [];
  }
}

function shouldBuy(token) {
  // شرایط ساده‌تر برای تست
  const isNew = token.age <= CONFIG.MAX_TOKEN_AGE;
  const hasLiquidity = token.liquidity >= CONFIG.MIN_LIQUIDITY;
  const notBought = !activePositions.some(p => p.pairAddress === token.pairAddress);
  
  const canBuy = isNew && hasLiquidity && notBought;
  
  if (canBuy) {
    console.log(`  ✅ ${token.symbol}: age=${token.age.toFixed(2)}s, liq=$${token.liquidity.toFixed(0)}`);
  }
  
  return canBuy;
}

async function buy(token) {
  if (stats.capital < CONFIG.POSITION_SIZE) {
    console.log(`⚠️ Not enough capital (${stats.capital.toFixed(2)} < ${CONFIG.POSITION_SIZE})`);
    return null;
  }
  
  const pos = {
    id: Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    token: token.name,
    symbol: token.symbol,
    address: token.address,
    pairAddress: token.pairAddress,
    buyPrice: token.price,
    quantity: CONFIG.POSITION_SIZE / token.price,
    investedAmount: CONFIG.POSITION_SIZE,
    buyTime: new Date().toISOString(),
    checkCount: 0,
  };
  
  activePositions.push(pos);
  stats.capital -= CONFIG.POSITION_SIZE;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🟢 BUY: ${pos.symbol} - $${CONFIG.POSITION_SIZE}`);
  console.log(`💰 Remaining Capital: $${stats.capital.toFixed(2)}`);
  console.log(`${'='.repeat(60)}\n`);
  
  saveData();
  return pos;
}

async function checkSell() {
  if (activePositions.length === 0) return;
  
  console.log(`🔍 Checking ${activePositions.length} positions...`);
  
  for (let i = activePositions.length - 1; i >= 0; i--) {
    const pos = activePositions[i];
    pos.checkCount++;
    
    // شبیه‌سازی تغییر قیمت
    const priceChange = (Math.random() * 100) - 30; // -30% تا +70%
    const currentPrice = pos.buyPrice * (1 + priceChange/100);
    
    const value = pos.quantity * currentPrice;
    const profit = value - pos.investedAmount;
    const profitPct = (profit / pos.investedAmount) * 100;
    
    console.log(`  📊 ${pos.symbol}: ${profitPct.toFixed(1)}%`);
    
    let sell = false;
    let reason = '';
    
    // Take profit: 50%
    if (profitPct >= CONFIG.TAKE_PROFIT * 100) {
      sell = true;
      reason = `🎯 TARGET HIT +${profitPct.toFixed(1)}%`;
    }
    
    if (sell) {
      const duration = (Date.now() - new Date(pos.buyTime)) / 1000;
      
      const trade = {
        ...pos,
        sellPrice: currentPrice,
        sellTime: new Date().toISOString(),
        profit,
        profitPercent: profitPct,
        duration,
        status: profit > 0 ? 'win' : 'loss',
        reason,
      };
      
      trades.push(trade);
      stats.totalTrades++;
      stats.totalProfit += profit;
      stats.capital += value;
      
      if (profit > 0) stats.wins++;
      else stats.losses++;
      
      console.log(`\n${'='.repeat(60)}`);
      console.log(`${profit > 0 ? '✅ WIN' : '❌ LOSS'}: ${pos.symbol}`);
      console.log(`💰 P/L: $${profit.toFixed(2)} (${profitPct.toFixed(1)}%)`);
      console.log(`💰 New Capital: $${stats.capital.toFixed(2)}`);
      console.log(`${'='.repeat(60)}\n`);
      
      activePositions.splice(i, 1);
      saveData();
    }
  }
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 INSTANT BUY BOT - SIMULATION MODE');
  console.log('='.repeat(60));
  console.log(`💰 Capital: $${CONFIG.INITIAL_CAPITAL}`);
  console.log(`🎯 Take Profit: ${CONFIG.TAKE_PROFIT * 100}%`);
  console.log(`📦 Position Size: $${CONFIG.POSITION_SIZE}`);
  console.log('='.repeat(60) + '\n');
  
  loadData();
  
  let scanCount = 0;
  
  setInterval(async () => {
    try {
      // چک پوزیشن‌های فعال
      await checkSell();
      
      // جستجوی توکن‌های جدید
      const canBuyMore = activePositions.length < CONFIG.MAX_POSITIONS;
      const hasCapital = stats.capital >= CONFIG.POSITION_SIZE;
      
      if (canBuyMore && hasCapital) {
        const tokens = await getNewTokens();
        stats.scannedTokens += tokens.length;
        
        if (tokens.length > 0) {
          // خرید اولین توکن مناسب
          for (const token of tokens) {
            if (shouldBuy(token)) {
              await buy(token);
              break; // فقط یک توکن در هر اسکن
            }
          }
        }
      }
      
      scanCount++;
      
      // گزارش ساعتی
      if (scanCount % 30 === 0) { // هر 1 دقیقه در تست
        const wr = stats.totalTrades > 0 ? (stats.wins / stats.totalTrades * 100).toFixed(1) : 0;
        const roi = ((stats.capital - CONFIG.INITIAL_CAPITAL) / CONFIG.INITIAL_CAPITAL * 100).toFixed(2);
        
        console.log(`\n📊 REPORT - Capital: $${stats.capital.toFixed(2)} | Trades: ${stats.totalTrades} | ROI: ${roi}%`);
        
        saveData();
      }
      
    } catch (err) {
      console.error('❌ Main loop error:', err);
    }
  }, CONFIG.CHECK_INTERVAL);
}

console.log('🚀 Starting Bot (Simulation Mode)...');
main();

module.exports = { trades, activePositions, stats };
