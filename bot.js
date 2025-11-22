// 🚀 PROFESSIONAL MEMECOIN TRADING BOT - 0.5s monitoring (FIXED VERSION)
const fetch = require('node-fetch');
const fs = require('fs');

// ⚙️ تنظیمات حرفه‌ای
const CONFIG = {
  WALLET: process.env.WALLET_ADDRESS || '754PMT7ogRSUbycaDceToSRUcSzRBB5aW7MaYFk3sEa7',
  CAPITAL: 10,
  TAKE_PROFIT: 0.50, // 50%
  STOP_LOSS: 0.20, // 20%
  CHECK_INTERVAL: 500, // 0.5 ثانیه
  MAX_TOKEN_AGE: 5, // افزایش به 5 ثانیه برای پیدا کردن بیشتر
  MIN_LIQUIDITY: 500,
  MIN_VOLUME: 100, // کاهش به 100 برای پیدا کردن توکن‌های بیشتر
  MAX_POSITIONS: 5,
  POSITION_SIZE: 0.15, // 15% سرمایه
  PUMP_THRESHOLD: 20,
  AUTO_BUY_SCORE_THRESHOLD: 40, // کاهش threshold برای خرید بیشتر
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
  console.log('💾 داده‌ها ذخیره شد');
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
      console.log(`📊 معاملات قبلی: ${trades.length}`);
      console.log(`💼 پوزیشن‌های فعال: ${activePositions.length}`);
    }
  } catch (err) {
    console.log('⚠️  شروع جدید...');
  }
}

// 🔍 دریافت توکن‌های جدید
async function getNewTokens() {
  const tokens = [];
  const now = Date.now();
  
  try {
    // DexScreener - جستجوی توکن‌های SOL
    if (!lastApiCall.search || now - lastApiCall.search > 2000) {
      lastApiCall.search = now;
      
      const res = await fetch('https://api.dexscreener.com/latest/dex/search?q=SOL', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 3000,
      });
      
      if (res.ok) {
        const data = await res.json();
        
        if (data.pairs && Array.isArray(data.pairs)) {
          console.log(`✅ پیدا شد: ${data.pairs.length} جفت معاملاتی`);
          
          data.pairs.forEach(pair => {
            if (pair.chainId === 'solana' && pair.baseToken?.address && pair.pairAddress) {
              const pairAge = pair.pairCreatedAt ? (now - pair.pairCreatedAt) / 1000 : 999;
              
              // فقط توکن‌هایی که اطلاعات کامل دارند
              if (pair.priceUsd && pair.liquidity?.usd) {
                tokens.push({
                  address: pair.baseToken.address,
                  symbol: pair.baseToken.symbol || 'UNKNOWN',
                  name: pair.baseToken.name || 'Unknown Token',
                  pairAddress: pair.pairAddress,
                  dex: pair.dexId || 'raydium',
                  price: parseFloat(pair.priceUsd),
                  liquidity: parseFloat(pair.liquidity.usd) || 0,
                  volume24h: parseFloat(pair.volume?.h24) || 0,
                  priceChange24h: parseFloat(pair.priceChange?.h24) || 0,
                  priceChange1h: parseFloat(pair.priceChange?.h1) || 0,
                  age: pairAge,
                  source: 'dexscreener',
                  txns24h: pair.txns?.h24 || {},
                });
              }
            }
          });
        }
      }
    }
    
    // DexScreener Profiles - توکن‌های جدید
    if (!lastApiCall.profiles || now - lastApiCall.profiles > 5000) {
      lastApiCall.profiles = now;
      
      const res2 = await fetch('https://api.dexscreener.com/token-profiles/latest/v1', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 3000,
      });
      
      if (res2.ok) {
        const profiles = await res2.json();
        
        if (Array.isArray(profiles)) {
          console.log(`✅ پیدا شد: ${profiles.length} پروفایل جدید`);
          
          for (const profile of profiles.slice(0, 10)) {
            if (profile.chainId === 'solana' && profile.tokenAddress) {
              // جستجوی اطلاعات کامل این توکن
              try {
                const tokenRes = await fetch(
                  `https://api.dexscreener.com/latest/dex/tokens/${profile.tokenAddress}`,
                  { timeout: 2000 }
                );
                
                if (tokenRes.ok) {
                  const tokenData = await tokenRes.json();
                  
                  if (tokenData.pairs && tokenData.pairs.length > 0) {
                    const bestPair = tokenData.pairs[0];
                    const pairAge = bestPair.pairCreatedAt ? (now - bestPair.pairCreatedAt) / 1000 : 0;
                    
                    tokens.push({
                      address: profile.tokenAddress,
                      symbol: bestPair.baseToken?.symbol || profile.name || 'NEW',
                      name: bestPair.baseToken?.name || profile.name || 'New Token',
                      pairAddress: bestPair.pairAddress,
                      dex: bestPair.dexId || 'raydium',
                      price: parseFloat(bestPair.priceUsd) || 0,
                      liquidity: parseFloat(bestPair.liquidity?.usd) || 0,
                      volume24h: parseFloat(bestPair.volume?.h24) || 0,
                      priceChange24h: parseFloat(bestPair.priceChange?.h24) || 0,
                      priceChange1h: parseFloat(bestPair.priceChange?.h1) || 0,
                      age: pairAge,
                      source: 'profile-' + profile.chainId,
                      isNew: true,
                    });
                  }
                }
              } catch (err) {
                // ادامه به توکن بعدی
              }
            }
          }
        }
      }
    }
    
  } catch (err) {
    console.error('⚠️  خطا در دریافت توکن‌ها:', err.message);
  }
  
  // حذف تکراری‌ها
  const uniqueTokens = [];
  const seen = new Set();
  
  for (const token of tokens) {
    const key = token.pairAddress || token.address;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueTokens.push(token);
    }
  }
  
  return uniqueTokens;
}

// 🧠 آنالیز توکن
function analyzeToken(token) {
  const scores = {
    liquidity: 0,
    volume: 0,
    priceAction: 0,
    age: 0,
    transactions: 0,
    total: 0,
  };
  
  // 1. نقدینگی (20 امتیاز)
  const liq = token.liquidity || 0;
  if (liq > 50000) scores.liquidity = 20;
  else if (liq > 10000) scores.liquidity = 16;
  else if (liq > 5000) scores.liquidity = 12;
  else if (liq > 1000) scores.liquidity = 8;
  else if (liq > 500) scores.liquidity = 4;
  
  // 2. حجم (20 امتیاز)
  const vol = token.volume24h || 0;
  if (vol > 100000) scores.volume = 20;
  else if (vol > 50000) scores.volume = 16;
  else if (vol > 10000) scores.volume = 12;
  else if (vol > 1000) scores.volume = 8;
  else if (vol > 100) scores.volume = 4;
  
  // 3. تغییر قیمت (30 امتیاز) - مهم‌ترین
  const priceChange1h = token.priceChange1h || 0;
  const priceChange24h = token.priceChange24h || 0;
  const bestChange = Math.max(priceChange1h, priceChange24h);
  
  if (bestChange > 200) scores.priceAction = 30; // پامپ خیلی قوی
  else if (bestChange > 100) scores.priceAction = 25; // پامپ قوی
  else if (bestChange > 50) scores.priceAction = 20; // پامپ خوب
  else if (bestChange > 20) scores.priceAction = 15;
  else if (bestChange > 10) scores.priceAction = 10;
  else if (bestChange > 0) scores.priceAction = 5;
  
  // 4. سن توکن (15 امتیاز)
  const age = token.age || 999;
  if (age < 2) scores.age = 15; // خیلی تازه
  else if (age < 5) scores.age = 12;
  else if (age < 10) scores.age = 10;
  else if (age < 30) scores.age = 6;
  else if (age < 60) scores.age = 3;
  
  // 5. تعداد تراکنش‌ها (15 امتیاز)
  const txns = (token.txns24h?.buys || 0) + (token.txns24h?.sells || 0);
  if (txns > 500) scores.transactions = 15;
  else if (txns > 200) scores.transactions = 12;
  else if (txns > 100) scores.transactions = 9;
  else if (txns > 50) scores.transactions = 6;
  else if (txns > 10) scores.transactions = 3;
  
  scores.total = scores.liquidity + scores.volume + scores.priceAction + scores.age + scores.transactions;
  
  // شرایط خاص
  const isPumping = bestChange > CONFIG.PUMP_THRESHOLD && vol > 1000;
  const isNew = token.isNew || age < 2;
  const hasGoodLiquidity = liq >= CONFIG.MIN_LIQUIDITY;
  const hasGoodVolume = vol >= CONFIG.MIN_VOLUME;
  
  // تصمیم خرید
  const shouldBuy = (
    (scores.total >= CONFIG.AUTO_BUY_SCORE_THRESHOLD || isPumping) &&
    hasGoodLiquidity &&
    age <= CONFIG.MAX_TOKEN_AGE
  );
  
  return {
    shouldBuy,
    isPumping,
    isNew,
    score: scores.total,
    breakdown: scores,
    reasons: buildReasons(token, scores, isPumping, isNew),
  };
}

function buildReasons(token, scores, isPumping, isNew) {
  const reasons = [];
  
  if (isPumping) reasons.push('🔥 PUMPING');
  if (isNew) reasons.push('⚡ BRAND NEW');
  if (scores.age >= 12) reasons.push('🆕 FRESH');
  if (scores.liquidity >= 16) reasons.push('💧 HIGH LIQ');
  if (scores.volume >= 16) reasons.push('📊 HIGH VOL');
  if (scores.priceAction >= 20) reasons.push('📈 MOONING');
  if (scores.transactions >= 12) reasons.push('🔥 HOT');
  
  return reasons.join(' | ');
}

// 💰 خرید (شبیه‌سازی)
async function buyToken(token) {
  const price = token.price || 0;
  if (!price || price <= 0) {
    console.log(`⚠️  قیمت نامعتبر برای ${token.symbol}`);
    return null;
  }
  
  const amount = stats.capital * CONFIG.POSITION_SIZE;
  if (stats.capital < amount) {
    console.log(`⚠️  سرمایه کافی نیست`);
    return null;
  }
  
  const quantity = amount / price;
  
  const position = {
    id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    token: token.name,
    symbol: token.symbol,
    address: token.address,
    pairAddress: token.pairAddress,
    dex: token.dex,
    buyPrice: price,
    quantity,
    investedAmount: amount,
    buyTime: new Date().toISOString(),
    status: 'active',
    highestPrice: price,
    lowestPrice: price,
    checkCount: 0,
  };
  
  activePositions.push(position);
  stats.capital -= amount;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🟢 BOUGHT: ${position.symbol}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`💵 Price: $${price.toFixed(8)}`);
  console.log(`📦 Amount: $${amount.toFixed(2)} (${quantity.toFixed(4)} tokens)`);
  console.log(`💧 Liquidity: $${(token.liquidity || 0).toFixed(0)}`);
  console.log(`📊 Volume 24h: $${(token.volume24h || 0).toFixed(0)}`);
  console.log(`⏱️  Token Age: ${(token.age || 0).toFixed(1)}s`);
  console.log(`🎯 Score: ${token.score || 0}/100`);
  console.log(`${token.reasons || ''}`);
  console.log(`${'='.repeat(60)}\n`);
  
  saveData();
  return position;
}

// 💸 فروش
async function checkAndSell() {
  if (activePositions.length === 0) return;
  
  console.log(`\n🔍 Checking ${activePositions.length} active positions...`);
  
  for (let i = activePositions.length - 1; i >= 0; i--) {
    const pos = activePositions[i];
    pos.checkCount = (pos.checkCount || 0) + 1;
    
    try {
      // دریافت قیمت فعلی
      const res = await fetch(
        `https://api.dexscreener.com/latest/dex/pairs/solana/${pos.pairAddress}`,
        { timeout: 3000 }
      );
      
      if (!res.ok) {
        console.log(`⚠️  خطا در دریافت قیمت ${pos.symbol}`);
        continue;
      }
      
      const data = await res.json();
      if (!data.pair || !data.pair.priceUsd) {
        console.log(`⚠️  داده نامعتبر برای ${pos.symbol}`);
        continue;
      }
      
      const currentPrice = parseFloat(data.pair.priceUsd);
      if (!currentPrice || currentPrice <= 0) continue;
      
      // آپدیت قیمت‌ها
      if (currentPrice > pos.highestPrice) pos.highestPrice = currentPrice;
      if (currentPrice < pos.lowestPrice) pos.lowestPrice = currentPrice;
      
      const currentValue = pos.quantity * currentPrice;
      const profit = currentValue - pos.investedAmount;
      const profitPercent = profit / pos.investedAmount;
      
      console.log(`  ${pos.symbol}: $${currentPrice.toFixed(8)} | P/L: ${(profitPercent * 100).toFixed(1)}% | Checks: ${pos.checkCount}`);
      
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
      
      // Trailing stop
      const dropFromATH = (pos.highestPrice - currentPrice) / pos.highestPrice;
      if (dropFromATH > 0.15 && profitPercent > 0.1) {
        shouldSell = true;
        reason = `📉 TRAILING STOP (secured ${(profitPercent * 100).toFixed(1)}%)`;
      }
      
      // فروش اجباری بعد از 50 چک (حدود 25 ثانیه)
      if (pos.checkCount > 50 && profitPercent > 0) {
        shouldSell = true;
        reason = `⏰ TIME EXIT +${(profitPercent * 100).toFixed(1)}%`;
      }
      
      if (shouldSell) {
        const duration = (new Date() - new Date(pos.buyTime)) / 1000;
        
        const trade = {
          ...pos,
          sellPrice: currentPrice,
          sellTime: new Date().toISOString(),
          profit,
          profitPercent: profitPercent * 100,
          duration,
          status: profit > 0 ? 'win' : 'loss',
          reason,
        };
        
        trades.push(trade);
        stats.totalTrades++;
        stats.totalProfit += profit;
        stats.capital += currentValue;
        
        console.log(`\n${'='.repeat(60)}`);
        if (profit > 0) {
          stats.wins++;
          console.log(`✅ SOLD (WIN): ${pos.symbol}`);
        } else {
          stats.losses++;
          console.log(`❌ SOLD (LOSS): ${pos.symbol}`);
        }
        console.log(`${'='.repeat(60)}`);
        console.log(`💵 Buy Price: $${pos.buyPrice.toFixed(8)}`);
        console.log(`💵 Sell Price: $${currentPrice.toFixed(8)}`);
        console.log(`💰 Profit/Loss: $${profit.toFixed(2)} (${(profitPercent * 100).toFixed(1)}%)`);
        console.log(`📊 ATH: $${pos.highestPrice.toFixed(8)}`);
        console.log(`⏱️  Duration: ${duration.toFixed(0)}s`);
        console.log(`${reason}`);
        console.log(`${'='.repeat(60)}\n`);
        
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
  console.log('\n' + '='.repeat(70));
  console.log('🚀 PROFESSIONAL MEMECOIN TRADING BOT - FIXED VERSION');
  console.log('='.repeat(70));
  console.log(`💰 Initial Capital: $${CONFIG.CAPITAL}`);
  console.log(`⏱️  Check Interval: ${CONFIG.CHECK_INTERVAL}ms`);
  console.log(`🎯 Take Profit: ${CONFIG.TAKE_PROFIT * 100}%`);
  console.log(`🛑 Stop Loss: ${CONFIG.STOP_LOSS * 100}%`);
  console.log(`⚡ Max Token Age: ${CONFIG.MAX_TOKEN_AGE}s`);
  console.log(`💧 Min Liquidity: $${CONFIG.MIN_LIQUIDITY}`);
  console.log(`📊 Min Volume: $${CONFIG.MIN_VOLUME}`);
  console.log(`📦 Position Size: ${CONFIG.POSITION_SIZE * 100}%`);
  console.log(`🎯 Auto-buy Score: ${CONFIG.AUTO_BUY_SCORE_THRESHOLD}+`);
  console.log('='.repeat(70) + '\n');
  
  loadData();
  
  let lastHourLog = new Date().getHours();
  let checkCount = 0;
  
  setInterval(async () => {
    try {
      checkCount++;
      
      // چک پوزیشن‌های فعال
      if (activePositions.length > 0) {
        await checkAndSell();
      }
      
      // جستجوی توکن‌های جدید (هر 4 چک)
      if (checkCount % 4 === 0 && 
          activePositions.length < CONFIG.MAX_POSITIONS && 
          stats.capital > 1.5) {
        
        console.log(`\n🔍 Scanning for new tokens... (Capital: $${stats.capital.toFixed(2)})`);
        
        const tokens = await getNewTokens();
        stats.scannedTokens += tokens.length;
        
        if (tokens.length === 0) {
          console.log('⚠️  هیچ توکنی پیدا نشد');
        } else {
          console.log(`✅ Found ${tokens.length} tokens, analyzing...`);
          
          // مرتب‌سازی بر اساس امتیاز
          const analyzedTokens = tokens
            .map(token => {
              const analysis = analyzeToken(token);
              return { ...token, ...analysis };
            })
            .sort((a, b) => b.score - a.score);
          
          // نمایش 5 توکن برتر
          console.log('\n📊 Top 5 Tokens:');
          analyzedTokens.slice(0, 5).forEach((token, idx) => {
            console.log(`  ${idx + 1}. ${token.symbol} - Score: ${token.score}/100 ${token.shouldBuy ? '✅ BUY' : ''}`);
            console.log(`     ${token.reasons}`);
          });
          
          // خرید بهترین گزینه
          for (const token of analyzedTokens) {
            const tokenId = token.pairAddress || token.address;
            
            if (seenTokens.has(tokenId)) continue;
            
            if (token.shouldBuy) {
              seenTokens.add(tokenId);
              
              console.log(`\n🎯 OPPORTUNITY FOUND!`);
              console.log(`   Token: ${token.symbol} (${token.name})`);
              console.log(`   Score: ${token.score}/100`);
              console.log(`   ${token.reasons}`);
              
              await buyToken(token);
              break;
            }
          }
        }
        
        // پاک کردن حافظه
        if (seenTokens.size > 5000) {
          const oldSize = seenTokens.size;
          seenTokens.clear();
          console.log(`🧹 Cleared token cache (${oldSize} tokens)`);
        }
      }
      
      // گزارش ساعتی
      const currentHour = new Date().getHours();
      if (currentHour !== lastHourLog) {
        const winRate = stats.totalTrades > 0 ? (stats.wins / stats.totalTrades * 100).toFixed(1) : 0;
        const roi = ((stats.capital - CONFIG.CAPITAL) / CONFIG.CAPITAL * 100).toFixed(2);
        const runningTime = ((Date.now() - stats.startTime) / 3600000).toFixed(1);
        
        console.log(`\n${'='.repeat(70)}`);
        console.log(`📊 HOURLY REPORT - ${new Date().toLocaleString('fa-IR')}`);
        console.log(`${'='.repeat(70)}`);
        console.log(`⏱️  Running Time: ${runningTime}h`);
        console.log(`💰 Capital: $${stats.capital.toFixed(2)} (ROI: ${roi}%)`);
        console.log(`📈 Total Trades: ${stats.totalTrades} | Wins: ${stats.wins} | Losses: ${stats.losses}`);
        console.log(`🎯 Win Rate: ${winRate}%`);
        console.log(`💵 Total P/L: $${stats.totalProfit.toFixed(2)}`);
        console.log(`💼 Active Positions: ${activePositions.length}`);
        console.log(`🔍 Tokens Scanned: ${stats.scannedTokens}`);
        console.log(`${'='.repeat(70)}\n`);
        
        lastHourLog = currentHour;
        saveData();
      }
      
    } catch (err) {
      console.error('❌ Main loop error:', err.message);
    }
  }, CONFIG.CHECK_INTERVAL);
}

// 🚀 START
console.log('🚀 Starting Trading Bot...');
mainLoop();

// مدیریت خطا
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  saveData();
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
});

// Export
module.exports = { trades, activePositions, stats, saveData };
