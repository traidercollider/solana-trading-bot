// Raydium Memecoin Trading Bot - 0.1s monitoring
const fetch = require('node-fetch');
const fs = require('fs');

// تنظیمات
const CONFIG = {
  WALLET: process.env.WALLET_ADDRESS || '754PMT7ogRSUbycaDceToSRUcSzRBB5aW7MaYFk3sEa7',
  CAPITAL: 10, // دلار
  TAKE_PROFIT: 0.5, // 50%
  STOP_LOSS: 0.2, // 20%
  CHECK_INTERVAL: 100, // 0.1 ثانیه
  TOKEN_AGE_MAX: 1000, // فقط توکن‌های زیر 1 ثانیه
};

// حافظه معاملات
let trades = [];
let activePositions = [];
let stats = {
  totalTrades: 0,
  wins: 0,
  losses: 0,
  totalProfit: 0,
  capital: CONFIG.CAPITAL,
  startTime: Date.now(),
};

// ذخیره داده‌ها
function saveData() {
  const data = {
    trades,
    activePositions,
    stats,
    lastUpdate: new Date().toISOString(),
  };
  fs.writeFileSync('trading_data.json', JSON.stringify(data, null, 2));
}

// بارگذاری داده‌ها
function loadData() {
  try {
    if (fs.existsSync('trading_data.json')) {
      const data = JSON.parse(fs.readFileSync('trading_data.json', 'utf8'));
      trades = data.trades || [];
      activePositions = data.activePositions || [];
      stats = data.stats || stats;
      console.log('✅ داده‌های قبلی بارگذاری شد');
    }
  } catch (err) {
    console.log('⚠️  فایل داده وجود ندارد، شروع جدید...');
  }
}

// دریافت توکن‌های جدید Raydium
async function getNewTokens() {
  try {
    const response = await fetch('https://api.raydium.io/v2/main/pairs');
    const data = await response.json();
    
    // فیلتر توکن‌های جدید (زیر 1 ثانیه)
    const now = Date.now();
    const newTokens = data.filter(pair => {
      const createdAt = new Date(pair.created_at).getTime();
      const age = (now - createdAt) / 1000; // سن به ثانیه
      return age < (CONFIG.TOKEN_AGE_MAX / 1000) && pair.liquidity > 1000;
    });
    
    return newTokens;
  } catch (err) {
    console.error('❌ خطا در دریافت توکن‌ها:', err.message);
    return [];
  }
}

// دریافت قیمت از Jupiter
async function getTokenPrice(tokenAddress) {
  try {
    const response = await fetch(`https://price.jup.ag/v6/price?ids=${tokenAddress}`);
    const data = await response.json();
    return data.data?.[tokenAddress]?.price || null;
  } catch (err) {
    // استفاده از DexScreener به عنوان بک‌آپ
    try {
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
      const data = await response.json();
      return data.pairs?.[0]?.priceUsd || null;
    } catch {
      return null;
    }
  }
}

// آنالیز توکن میم
function analyzeMemeToken(token) {
  const score = {
    liquidity: 0,
    volume: 0,
    holders: 0,
    age: 0,
    total: 0,
  };
  
  // امتیاز نقدینگی
  if (token.liquidity > 10000) score.liquidity = 30;
  else if (token.liquidity > 5000) score.liquidity = 20;
  else if (token.liquidity > 1000) score.liquidity = 10;
  
  // امتیاز حجم معاملات
  if (token.volume_24h > 50000) score.volume = 30;
  else if (token.volume_24h > 10000) score.volume = 20;
  else if (token.volume_24h > 5000) score.volume = 10;
  
  // امتیاز سن (جدیدتر = بهتر برای میم‌کوین)
  const age = (Date.now() - new Date(token.created_at).getTime()) / 1000;
  if (age < 0.5) score.age = 40;
  else if (age < 1) score.age = 30;
  
  score.total = score.liquidity + score.volume + score.age;
  
  return {
    shouldBuy: score.total >= 50,
    score: score.total,
    reasons: score,
  };
}

// خرید فرضی
async function buyToken(token) {
  const price = await getTokenPrice(token.base_mint);
  if (!price) return null;
  
  const amount = CONFIG.CAPITAL * 0.1; // 10% از سرمایه
  const quantity = amount / price;
  
  const position = {
    id: `POS_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    token: token.name,
    symbol: token.base_symbol,
    address: token.base_mint,
    buyPrice: price,
    quantity,
    investedAmount: amount,
    buyTime: new Date().toISOString(),
    status: 'active',
  };
  
  activePositions.push(position);
  stats.capital -= amount;
  
  console.log(`\n🟢 خرید: ${token.name} (${token.base_symbol})`);
  console.log(`   قیمت: $${price.toFixed(8)}`);
  console.log(`   مقدار: ${quantity.toFixed(2)} توکن`);
  console.log(`   سرمایه: $${amount.toFixed(2)}`);
  
  return position;
}

// بررسی و فروش
async function checkAndSellPositions() {
  for (let i = activePositions.length - 1; i >= 0; i--) {
    const pos = activePositions[i];
    const currentPrice = await getTokenPrice(pos.address);
    
    if (!currentPrice) continue;
    
    const currentValue = pos.quantity * currentPrice;
    const profitPercent = (currentValue - pos.investedAmount) / pos.investedAmount;
    
    let shouldSell = false;
    let reason = '';
    
    // چک سود هدف
    if (profitPercent >= CONFIG.TAKE_PROFIT) {
      shouldSell = true;
      reason = `سود ${(profitPercent * 100).toFixed(1)}% (هدف: ${CONFIG.TAKE_PROFIT * 100}%)`;
    }
    
    // چک استاپ لاس
    if (profitPercent <= -CONFIG.STOP_LOSS) {
      shouldSell = true;
      reason = `ضرر ${(profitPercent * 100).toFixed(1)}% (استاپ: ${CONFIG.STOP_LOSS * 100}%)`;
    }
    
    if (shouldSell) {
      const profit = currentValue - pos.investedAmount;
      
      // ثبت معامله
      const trade = {
        ...pos,
        sellPrice: currentPrice,
        sellTime: new Date().toISOString(),
        profit,
        profitPercent: profitPercent * 100,
        duration: (new Date() - new Date(pos.buyTime)) / 1000,
        status: profit > 0 ? 'win' : 'loss',
        reason,
      };
      
      trades.push(trade);
      stats.totalTrades++;
      stats.totalProfit += profit;
      stats.capital += currentValue;
      
      if (profit > 0) {
        stats.wins++;
        console.log(`\n🟢 فروش سودآور: ${pos.symbol}`);
      } else {
        stats.losses++;
        console.log(`\n🔴 فروش ضررده: ${pos.symbol}`);
      }
      
      console.log(`   قیمت خرید: $${pos.buyPrice.toFixed(8)}`);
      console.log(`   قیمت فروش: $${currentPrice.toFixed(8)}`);
      console.log(`   سود/ضرر: $${profit.toFixed(2)} (${(profitPercent * 100).toFixed(1)}%)`);
      console.log(`   دلیل: ${reason}`);
      
      // حذف از پوزیشن‌های فعال
      activePositions.splice(i, 1);
      
      saveData();
    }
  }
}

// حلقه اصلی
async function mainLoop() {
  console.log('\n🚀 ربات تریدینگ شروع شد...');
  console.log(`💰 سرمایه اولیه: $${CONFIG.CAPITAL}`);
  console.log(`⏱️  بررسی هر ${CONFIG.CHECK_INTERVAL}ms`);
  console.log(`🎯 سود هدف: ${CONFIG.TAKE_PROFIT * 100}% | استاپ لاس: ${CONFIG.STOP_LOSS * 100}%\n`);
  
  loadData();
  
  let lastHourLog = new Date().getHours();
  
  setInterval(async () => {
    try {
      // بررسی پوزیشن‌های فعال
      await checkAndSellPositions();
      
      // جستجوی توکن‌های جدید
      if (activePositions.length < 5 && stats.capital > 1) {
        const newTokens = await getNewTokens();
        
        for (const token of newTokens.slice(0, 3)) {
          const analysis = analyzeMemeToken(token);
          
          if (analysis.shouldBuy) {
            await buyToken(token);
            break; // فقط یک خرید در هر چک
          }
        }
      }
      
      // گزارش ساعتی
      const currentHour = new Date().getHours();
      if (currentHour !== lastHourLog) {
        console.log(`\n📊 گزارش ساعت ${currentHour}:00`);
        console.log(`   معاملات: ${stats.totalTrades} | برد: ${stats.wins} | باخت: ${stats.losses}`);
        console.log(`   سود کل: $${stats.totalProfit.toFixed(2)}`);
        console.log(`   سرمایه فعلی: $${stats.capital.toFixed(2)}`);
        console.log(`   پوزیشن‌های فعال: ${activePositions.length}`);
        
        lastHourLog = currentHour;
        saveData();
      }
      
    } catch (err) {
      console.error('❌ خطا در حلقه اصلی:', err.message);
    }
  }, CONFIG.CHECK_INTERVAL);
}

// شروع
mainLoop();

// Export برای استفاده در server
module.exports = { trades, activePositions, stats, saveData };
