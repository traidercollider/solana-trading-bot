// Raydium Memecoin Trading Bot - نسخه اصلاح شده با DexScreener
const fetch = require('node-fetch');
const fs = require('fs');

// تنظیمات
const CONFIG = {
  WALLET: process.env.WALLET_ADDRESS || '754PMT7ogRSUbycaDceToSRUcSzRBB5aW7MaYFk3sEa7',
  CAPITAL: 10, // دلار
  TAKE_PROFIT: 0.5, // 50%
  STOP_LOSS: 0.2, // 20%
  CHECK_INTERVAL: 5000, // 5 ثانیه (کاهش برای جلوگیری از rate limit)
  MIN_LIQUIDITY: 1000, // حداقل نقدینگی
  MIN_VOLUME: 5000, // حداقل حجم معاملات 24 ساعته
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

// ذخیره توکن‌های چک شده
let checkedTokens = new Set();

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

// دریافت توکن‌های جدید از DexScreener (Solana)
async function getNewTokens() {
  try {
    // دریافت توکن‌های trending در Solana
    const response = await fetch('https://api.dexscreener.com/latest/dex/search?q=SOL', {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.pairs || data.pairs.length === 0) {
      return [];
    }
    
    // فیلتر: فقط Raydium و Solana
    const raydiumTokens = data.pairs.filter(pair => {
      return pair.chainId === 'solana' && 
             pair.dexId === 'raydium' &&
             pair.liquidity?.usd > CONFIG.MIN_LIQUIDITY &&
             pair.volume?.h24 > CONFIG.MIN_VOLUME;
    });
    
    console.log(`✅ پیدا شد: ${raydiumTokens.length} توکن Raydium`);
    return raydiumTokens;
    
  } catch (err) {
    console.error('❌ خطا در DexScreener:', err.message);
    
    // بک‌آپ: استفاده از لیست پاپولار
    try {
      const response = await fetch('https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112');
      const data = await response.json();
      return data.pairs?.slice(0, 10) || [];
    } catch {
      return [];
    }
  }
}

// دریافت قیمت از Jupiter
async function getTokenPrice(tokenAddress) {
  try {
    const response = await fetch(`https://price.jup.ag/v6/price?ids=${tokenAddress}`);
    const data = await response.json();
    return data.data?.[tokenAddress]?.price || null;
  } catch (err) {
    console.error('⚠️  خطا در Jupiter:', err.message);
    return null;
  }
}

// آنالیز توکن میم
function analyzeMemeToken(token) {
  const score = {
    liquidity: 0,
    volume: 0,
    priceChange: 0,
    total: 0,
  };
  
  // امتیاز نقدینگی
  const liq = token.liquidity?.usd || 0;
  if (liq > 50000) score.liquidity = 40;
  else if (liq > 10000) score.liquidity = 30;
  else if (liq > 5000) score.liquidity = 20;
  else if (liq > 1000) score.liquidity = 10;
  
  // امتیاز حجم معاملات
  const vol = token.volume?.h24 || 0;
  if (vol > 100000) score.volume = 30;
  else if (vol > 50000) score.volume = 20;
  else if (vol > 10000) score.volume = 10;
  
  // امتیاز تغییر قیمت (مثبت = خوب)
  const priceChange = token.priceChange?.h24 || 0;
  if (priceChange > 50) score.priceChange = 30;
  else if (priceChange > 20) score.priceChange = 20;
  else if (priceChange > 10) score.priceChange = 10;
  
  score.total = score.liquidity + score.volume + score.priceChange;
  
  return {
    shouldBuy: score.total >= 40, // حداقل امتیاز 40
    score: score.total,
    reasons: score,
  };
}

// خرید فرضی
async function buyToken(token) {
  const price = parseFloat(token.priceUsd) || 0;
  if (!price || price <= 0) return null;
  
  const amount = CONFIG.CAPITAL * 0.2; // 20% از سرمایه
  if (stats.capital < amount) return null;
  
  const quantity = amount / price;
  
  const position = {
    id: `POS_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    token: token.baseToken?.name || 'Unknown',
    symbol: token.baseToken?.symbol || '???',
    address: token.baseToken?.address || '',
    pairAddress: token.pairAddress,
    buyPrice: price,
    quantity,
    investedAmount: amount,
    buyTime: new Date().toISOString(),
    status: 'active',
  };
  
  activePositions.push(position);
  stats.capital -= amount;
  
  console.log(`\n🟢 خرید: ${position.token} (${position.symbol})`);
  console.log(`   قیمت: $${price.toFixed(8)}`);
  console.log(`   مقدار: ${quantity.toFixed(2)} توکن`);
  console.log(`   سرمایه: $${amount.toFixed(2)}`);
  console.log(`   نقدینگی: $${(token.liquidity?.usd || 0).toFixed(0)}`);
  console.log(`   حجم 24h: $${(token.volume?.h24 || 0).toFixed(0)}`);
  
  saveData();
  return position;
}

// بررسی و فروش
async function checkAndSellPositions() {
  for (let i = activePositions.length - 1; i >= 0; i--) {
    const pos = activePositions[i];
    
    try {
      // دریافت قیمت فعلی از DexScreener
      const response = await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${pos.pairAddress}`);
      const data = await response.json();
      
      if (!data.pair) continue;
      
      const currentPrice = parseFloat(data.pair.priceUsd) || 0;
      if (!currentPrice) continue;
      
      const currentValue = pos.quantity * currentPrice;
      const profitPercent = (currentValue - pos.investedAmount) / pos.investedAmount;
      
      let shouldSell = false;
      let reason = '';
      
      // چک سود هدف
      if (profitPercent >= CONFIG.TAKE_PROFIT) {
        shouldSell = true;
        reason = `سود ${(profitPercent * 100).toFixed(1)}% 🎯`;
      }
      
      // چک استاپ لاس
      if (profitPercent <= -CONFIG.STOP_LOSS) {
        shouldSell = true;
        reason = `ضرر ${(profitPercent * 100).toFixed(1)}% 🛑`;
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
          console.log(`\n✅ فروش سودآور: ${pos.symbol}`);
        } else {
          stats.losses++;
          console.log(`\n❌ فروش ضررده: ${pos.symbol}`);
        }
        
        console.log(`   قیمت خرید: $${pos.buyPrice.toFixed(8)}`);
        console.log(`   قیمت فروش: $${currentPrice.toFixed(8)}`);
        console.log(`   سود/ضرر: $${profit.toFixed(2)} (${(profitPercent * 100).toFixed(1)}%)`);
        console.log(`   دلیل: ${reason}`);
        
        // حذف از پوزیشن‌های فعال
        activePositions.splice(i, 1);
        
        saveData();
      }
      
    } catch (err) {
      console.error(`⚠️  خطا در چک کردن ${pos.symbol}:`, err.message);
    }
  }
}

// حلقه اصلی
async function mainLoop() {
  console.log('\n🚀 ربات تریدینگ شروع شد...');
  console.log(`💰 سرمایه اولیه: $${CONFIG.CAPITAL}`);
  console.log(`⏱️  بررسی هر ${CONFIG.CHECK_INTERVAL / 1000} ثانیه`);
  console.log(`🎯 سود هدف: ${CONFIG.TAKE_PROFIT * 100}% | استاپ لاس: ${CONFIG.STOP_LOSS * 100}%`);
  console.log(`💧 نقدینگی حداقل: $${CONFIG.MIN_LIQUIDITY}`);
  console.log(`📊 حجم حداقل: $${CONFIG.MIN_VOLUME}\n`);
  
  loadData();
  
  let lastHourLog = new Date().getHours();
  let checkCount = 0;
  
  setInterval(async () => {
    try {
      checkCount++;
      
      // بررسی پوزیشن‌های فعال
      if (activePositions.length > 0) {
        await checkAndSellPositions();
      }
      
      // جستجوی توکن‌های جدید (هر 3 چک یکبار)
      if (checkCount % 3 === 0 && activePositions.length < 3 && stats.capital > 2) {
        const newTokens = await getNewTokens();
        
        for (const token of newTokens) {
          const tokenId = token.baseToken?.address || token.pairAddress;
          
          // جلوگیری از خرید مجدد
          if (checkedTokens.has(tokenId)) continue;
          checkedTokens.add(tokenId);
          
          const analysis = analyzeMemeToken(token);
          
          if (analysis.shouldBuy) {
            console.log(`\n🔍 توکن خوب پیدا شد: ${token.baseToken?.symbol}`);
            console.log(`   امتیاز: ${analysis.score}/100`);
            console.log(`   نقدینگی: $${(token.liquidity?.usd || 0).toFixed(0)}`);
            console.log(`   حجم 24h: $${(token.volume?.h24 || 0).toFixed(0)}`);
            console.log(`   تغییر 24h: ${(token.priceChange?.h24 || 0).toFixed(1)}%`);
            
            await buyToken(token);
            break; // فقط یک خرید در هر دور
          }
        }
        
        // پاک کردن حافظه توکن‌های قدیمی
        if (checkedTokens.size > 1000) {
          checkedTokens.clear();
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
        console.log(`   نرخ برد: ${stats.totalTrades > 0 ? (stats.wins / stats.totalTrades * 100).toFixed(1) : 0}%`);
        
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
