// 🚀 PROFESSIONAL MEMECOIN TRADING BOT - 0.5s monitoring
const fetch = require('node-fetch');
const fs = require('fs');

// ⚙️ تنظیمات حرفه‌ای
const CONFIG = {
  WALLET: process.env.WALLET_ADDRESS || '754PMT7ogRSUbycaDceToSRUcSzRBB5aW7MaYFk3sEa7',
  CAPITAL: 10,
  TAKE_PROFIT: 0.50, // 50%
  STOP_LOSS: 0.20, // 20%
  CHECK_INTERVAL: 500, // 0.5 ثانیه - سریع‌ترین حالت ممکن
  MAX_TOKEN_AGE: 2, // فقط توکن‌های زیر 2 ثانیه
  MIN_LIQUIDITY: 500, // حداقل $500 نقدینگی
  MIN_VOLUME: 1000, // حداقل $1000 حجم
  MAX_POSITIONS: 5, // حداکثر 5 پوزیشن همزمان
  POSITION_SIZE: 0.15, // 15% سرمایه در هر معامله
  PUMP_THRESHOLD: 20, // 20% رشد = پامپ
};

// 💾 حافظه
let trades = [];
let activePositions = [];
let seenTokens = new Set();
let lastApiCall = {};

let stats = {
  totalTrades: 0,
  wins: 0,
  losses: 0,
  totalProfit: 0,
  capital: CONFIG.CAPITAL,
  startTime: Date.now(),
  scannedTokens: 0,
  missedOpportunities: 0,
};

// 📝 ذخیره داده
function saveData() {
  const data = {
    trades,
    activePositions,
    stats,
    lastUpdate: new Date().toISOString(),
  };
  fs.writeFileSync('trading_data.json', JSON.stringify(data, null, 2));
}

// 📖 بارگذاری
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
    console.log('⚠️  شروع جدید...');
  }
}

// 🔍 دریافت توکن‌های جدید - چند منبع
async function getNewTokens() {
  const tokens = [];
  const now = Date.now();
  
  try {
    // منبع 1: DexScreener - توکن‌های Trending
    if (!lastApiCall.dexscreener || now - lastApiCall.dexscreener > 3000) {
      lastApiCall.dexscreener = now;
      
      const res = await fetch('https://api.dexscreener.com/token-profiles/latest/v1', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 2000,
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data)) {
          data.forEach(profile => {
            if (profile.chainId === 'solana' && profile.tokenAddress) {
              tokens.push({
                address: profile.tokenAddress,
                source: 'dexscreener-profile',
                timestamp: new Date(profile.timestamp).getTime(),
              });
            }
          });
        }
      }
    }
    
    // منبع 2: DexScreener Search - SOL pairs
    if (!lastApiCall.search || now - lastApiCall.search > 2000) {
      lastApiCall.search = now;
      
      const res2 = await fetch('https://api.dexscreener.com/latest/dex/search?q=SOL', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 2000,
      });
      
      if (res2.ok) {
        const data = await res2.json();
        if (data.pairs) {
          data.pairs.forEach(pair => {
            if (pair.chainId === 'solana' && pair.baseToken?.address) {
              const age = pair.pairCreatedAt ? (now - pair.pairCreatedAt) / 1000 : 999;
              
              tokens.push({
                address: pair.baseToken.address,
                symbol: pair.baseToken.symbol,
                name: pair.baseToken.name,
                pairAddress: pair.pairAddress,
                dex: pair.dexId,
                price: parseFloat(pair.priceUsd) || 0,
                liquidity: pair.liquidity?.usd || 0,
                volume24h: pair.volume?.h24 || 0,
                priceChange24h: pair.priceChange?.h24 || 0,
                age,
                source: 'dexscreener-search',
              });
            }
          });
        }
      }
    }
    
  } catch (err) {
    console.error('⚠️  خطا در دریافت توکن‌ها:', err.message);
  }
  
  return tokens;
}

// 🧠 آنالیز پیشرفته - ML Scoring
function analyzeToken(token) {
  const scores = {
    liquidity: 0,
    volume: 0,
    priceAction: 0,
    age: 0,
    total: 0,
  };
  
  // 1. نقدینگی (وزن: 25%)
  const liq = token.liquidity || 0;
  if (liq > 50000) scores.liquidity = 25;
  else if (liq > 10000) scores.liquidity = 20;
  else if (liq > 5000) scores.liquidity = 15;
  else if (liq > 1000) scores.liquidity = 10;
  else if (liq > 500) scores.liquidity = 5;
  
  // 2. حجم معاملات (وزن: 25%)
  const vol = token.volume24h || 0;
  if (vol > 100000) scores.volume = 25;
  else if (vol > 50000) scores.volume = 20;
  else if (vol > 10000) scores.volume = 15;
  else if (vol > 5000) scores.volume = 10;
  else if (vol > 1000) scores.volume = 5;
  
  // 3. تغییر قیمت (وزن: 30%) - مهم‌ترین
  const priceChange = token.priceChange24h || 0;
  if (priceChange > 100) scores.priceAction = 30; // پامپ قوی
  else if (priceChange > 50) scores.priceAction = 25; // پامپ خوب
  else if (priceChange > 20) scores.priceAction = 20; // رشد خوب
  else if (priceChange > 10) scores.priceAction = 15;
  else if (priceChange > 5) scores.priceAction = 10;
  else if (priceChange > 0) scores.priceAction = 5;
  
  // 4. سن توکن (وزن: 20%) - جدیدتر = بهتر
  const age = token.age || 999;
  if (age < 1) scores.age = 20; // زیر 1 ثانیه - عالی!
  else if (age < 2) scores.age = 18; // زیر 2 ثانیه - خوب
  else if (age < 5) scores.age = 15;
  else if (age < 10) scores.age = 10;
  else if (age < 30) scores.age = 5;
  
  scores.total = scores.liquidity + scores.volume + scores.priceAction + scores.age;
  
  // تشخیص پامپ
  const isPumping = priceChange > CONFIG.PUMP_THRESHOLD && vol > 5000;
  
  // شرایط خرید: امتیاز بالای 50 یا پامپ قوی
  const shouldBuy = (scores.total >= 50 || isPumping) && 
                    age <= CONFIG.MAX_TOKEN_AGE &&
                    liq >= CONFIG.MIN_LIQUIDITY;
  
  return {
    shouldBuy,
    isPumping,
    score: scores.total,
    breakdown: scores,
    reasons: buildReasons(token, scores, isPumping),
  };
}

function buildReasons(token, scores, isPumping) {
  const reasons = [];
  
  if (isPumping) reasons.push('🔥 PUMPING');
  if (scores.age >= 18) reasons.push('⚡ FRESH');
  if (scores.liquidity >= 20) reasons.push('💧 HIGH LIQ');
  if (scores.volume >= 20) reasons.push('📊 HIGH VOL');
  if (scores.priceAction >= 25) reasons.push('📈 MOONING');
  
  return reasons.join(' | ');
}

// 💰 خرید
async function buyToken(token) {
  const price = token.price || 0;
  if (!price || price <= 0) return null;
  
  const amount = stats.capital * CONFIG.POSITION_SIZE;
  if (stats.capital < amount) return null;
  
  const quantity = amount / price;
  
  const position = {
    id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    token: token.name || 'Unknown',
    symbol: token.symbol || '???',
    address: token.address,
    pairAddress: token.pairAddress,
    dex: token.dex || 'unknown',
    buyPrice: price,
    quantity,
    investedAmount: amount,
    buyTime: new Date().toISOString(),
    status: 'active',
    highestPrice: price,
    lowestPrice: price,
  };
  
  activePositions.push(position);
  stats.capital -= amount;
  
  console.log(`\n🟢 BUY: ${position.symbol}`);
  console.log(`   💵 Price: $${price.toFixed(8)}`);
  console.log(`   📦 Amount: $${amount.toFixed(2)} (${quantity.toFixed(4)} tokens)`);
  console.log(`   💧 Liq: $${(token.liquidity || 0).toFixed(0)}`);
  console.log(`   📊 Vol: $${(token.volume24h || 0).toFixed(0)}`);
  console.log(`   ⏱️  Age: ${(token.age || 0).toFixed(1)}s`);
  console.log(`   ${token.reasons || ''}`);
  
  saveData();
  return position;
}

// 💸 فروش
async function checkAndSell() {
  for (let i = activePositions.length - 1; i >= 0; i--) {
    const pos = activePositions[i];
    
    try {
      // دریافت قیمت فعلی
      const res = await fetch(
        `https://api.dexscreener.com/latest/dex/pairs/solana/${pos.pairAddress}`,
        { timeout: 2000 }
      );
      
      if (!res.ok) continue;
      
      const data = await res.json();
      if (!data.pair) continue;
      
      const currentPrice = parseFloat(data.pair.priceUsd) || 0;
      if (!currentPrice || currentPrice <= 0) continue;
      
      // آپدیت قیمت‌های بالا و پایین
      if (currentPrice > pos.highestPrice) pos.highestPrice = currentPrice;
      if (currentPrice < pos.lowestPrice) pos.lowestPrice = currentPrice;
      
      const currentValue = pos.quantity * currentPrice;
      const profit = currentValue - pos.investedAmount;
      const profitPercent = profit / pos.investedAmount;
      
      let shouldSell = false;
      let reason = '';
      
      // استراتژی فروش
      if (profitPercent >= CONFIG.TAKE_PROFIT) {
        shouldSell = true;
        reason = `🎯 TARGET HIT +${(profitPercent * 100).toFixed(1)}%`;
      } else if (profitPercent <= -CONFIG.STOP_LOSS) {
        shouldSell = true;
        reason = `🛑 STOP LOSS ${(profitPercent * 100).toFixed(1)}%`;
      }
      
      // Trailing stop: اگر از ATH بیش از 15% افتاد، بفروش
      const dropFromATH = (pos.highestPrice - currentPrice) / pos.highestPrice;
      if (dropFromATH > 0.15 && profitPercent > 0.1) {
        shouldSell = true;
        reason = `📉 TRAILING STOP (${(profitPercent * 100).toFixed(1)}% profit secured)`;
      }
      
      if (shouldSell) {
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
          console.log(`\n✅ WIN: ${pos.symbol}`);
        } else {
          stats.losses++;
          console.log(`\n❌ LOSS: ${pos.symbol}`);
        }
        
        console.log(`   💵 Buy: $${pos.buyPrice.toFixed(8)}`);
        console.log(`   💵 Sell: $${currentPrice.toFixed(8)}`);
        console.log(`   💰 P/L: $${profit.toFixed(2)} (${(profitPercent * 100).toFixed(1)}%)`);
        console.log(`   📊 ATH: $${pos.highestPrice.toFixed(8)}`);
        console.log(`   ⏱️  Duration: ${trade.duration.toFixed(0)}s`);
        console.log(`   ${reason}`);
        
        activePositions.splice(i, 1);
        saveData();
      }
      
    } catch (err) {
      console.error(`⚠️  Error checking ${pos.symbol}:`, err.message);
    }
  }
}

// 🔄 حلقه اصلی
async function mainLoop() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 PROFESSIONAL MEMECOIN TRADING BOT');
  console.log('='.repeat(60));
  console.log(`💰 Capital: $${CONFIG.CAPITAL}`);
  console.log(`⏱️  Interval: ${CONFIG.CHECK_INTERVAL}ms (${1000/CONFIG.CHECK_INTERVAL}x per second)`);
  console.log(`🎯 Take Profit: ${CONFIG.TAKE_PROFIT * 100}%`);
  console.log(`🛑 Stop Loss: ${CONFIG.STOP_LOSS * 100}%`);
  console.log(`⚡ Max Token Age: ${CONFIG.MAX_TOKEN_AGE}s`);
  console.log(`💧 Min Liquidity: $${CONFIG.MIN_LIQUIDITY}`);
  console.log(`📊 Position Size: ${CONFIG.POSITION_SIZE * 100}%`);
  console.log('='.repeat(60) + '\n');
  
  loadData();
  
  let lastHourLog = new Date().getHours();
  let checkCount = 0;
  
  setInterval(async () => {
    try {
      checkCount++;
      
      // چک پوزیشن‌های فعال (هر بار)
      if (activePositions.length > 0) {
        await checkAndSell();
      }
      
      // جستجوی توکن‌های جدید (هر 2 چک)
      if (checkCount % 2 === 0 && 
          activePositions.length < CONFIG.MAX_POSITIONS && 
          stats.capital > 1) {
        
        const tokens = await getNewTokens();
        stats.scannedTokens += tokens.length;
        
        for (const token of tokens) {
          const tokenId = token.address;
          
          // جلوگیری از خرید مجدد
          if (seenTokens.has(tokenId)) continue;
          
          // آنالیز توکن
          const analysis = analyzeToken(token);
          
          if (analysis.shouldBuy) {
            seenTokens.add(tokenId);
            
            console.log(`\n🔍 OPPORTUNITY FOUND!`);
            console.log(`   ${token.symbol} (${token.name})`);
            console.log(`   Score: ${analysis.score}/100`);
            console.log(`   ${analysis.reasons}`);
            
            await buyToken(token);
            break; // فقط یک خرید در هر دور
          }
        }
        
        // پاک کردن حافظه (هر 10000 توکن)
        if (seenTokens.size > 10000) {
          seenTokens.clear();
          console.log('🧹 Cleared token cache');
        }
      }
      
      // گزارش ساعتی
      const currentHour = new Date().getHours();
      if (currentHour !== lastHourLog) {
        const winRate = stats.totalTrades > 0 ? (stats.wins / stats.totalTrades * 100).toFixed(1) : 0;
        const roi = ((stats.capital - CONFIG.CAPITAL) / CONFIG.CAPITAL * 100).toFixed(2);
        
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📊 HOURLY REPORT - ${currentHour}:00`);
        console.log(`${'='.repeat(60)}`);
        console.log(`💰 Capital: $${stats.capital.toFixed(2)} (ROI: ${roi}%)`);
        console.log(`📈 Trades: ${stats.totalTrades} | Wins: ${stats.wins} | Losses: ${stats.losses}`);
        console.log(`🎯 Win Rate: ${winRate}%`);
        console.log(`💵 Total P/L: $${stats.totalProfit.toFixed(2)}`);
        console.log(`📊 Active Positions: ${activePositions.length}`);
        console.log(`🔍 Tokens Scanned: ${stats.scannedTokens}`);
        console.log(`${'='.repeat(60)}\n`);
        
        lastHourLog = currentHour;
        saveData();
      }
      
    } catch (err) {
      console.error('❌ Main loop error:', err.message);
    }
  }, CONFIG.CHECK_INTERVAL);
}

// 🚀 START
mainLoop();

// Export
module.exports = { trades, activePositions, stats, saveData };
