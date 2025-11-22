// 🚀 MEMECOIN TRADING BOT - AGGRESSIVE BUY MODE
const fetch = require('node-fetch');
const fs = require('fs');

const CONFIG = {
  WALLET: process.env.WALLET_ADDRESS || '754PMT7ogRSUbycaDceToSRUcSzRBB5aW7MaYFk3sEa7',
  CAPITAL: 10,
  TAKE_PROFIT: 0.50, // 50%
  STOP_LOSS: 0.20, // 20%
  CHECK_INTERVAL: 500,
  MAX_TOKEN_AGE: 10, // افزایش به 10 ثانیه
  MIN_LIQUIDITY: 300, // کاهش به 300
  MIN_VOLUME: 50, // کاهش به 50
  MAX_POSITIONS: 5,
  POSITION_SIZE: 0.15,
  PUMP_THRESHOLD: 15, // کاهش به 15%
  AUTO_BUY_SCORE_THRESHOLD: 35, // کاهش به 35
};

let trades = [];
let activePositions = [];
let seenTokens = new Set();
let lastApiCall = {};
let boughtTokens = new Set(); // فقط توکن‌های خریداری شده

let stats = {
  totalTrades: 0,
  wins: 0,
  losses: 0,
  totalProfit: 0,
  capital: CONFIG.CAPITAL,
  startTime: Date.now(),
  scannedTokens: 0,
};

function saveData() {
  const data = {
    trades,
    activePositions,
    stats,
    lastUpdate: new Date().toISOString(),
  };
  fs.writeFileSync('trading_data.json', JSON.stringify(data, null, 2));
}

function loadData() {
  try {
    if (fs.existsSync('trading_data.json')) {
      const data = JSON.parse(fs.readFileSync('trading_data.json', 'utf8'));
      trades = data.trades || [];
      activePositions = data.activePositions || [];
      stats = data.stats || stats;
      
      // بازیابی لیست توکن‌های خریداری شده
      activePositions.forEach(pos => boughtTokens.add(pos.pairAddress));
      trades.forEach(trade => boughtTokens.add(trade.pairAddress));
      
      console.log('✅ داده‌ها بارگذاری شد');
      console.log(`📊 معاملات: ${trades.length}, پوزیشن‌ها: ${activePositions.length}`);
    }
  } catch (err) {
    console.log('⚠️ شروع جدید...');
  }
}

async function getNewTokens() {
  const tokens = [];
  const now = Date.now();
  
  try {
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
                  txns24h: pair.txns?.h24 || {},
                });
              }
            }
          });
        }
      }
    }
    
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
                      symbol: bestPair.baseToken?.symbol || 'NEW',
                      name: bestPair.baseToken?.name || 'New Token',
                      pairAddress: bestPair.pairAddress,
                      dex: bestPair.dexId || 'raydium',
                      price: parseFloat(bestPair.priceUsd) || 0,
                      liquidity: parseFloat(bestPair.liquidity?.usd) || 0,
                      volume24h: parseFloat(bestPair.volume?.h24) || 0,
                      priceChange24h: parseFloat(bestPair.priceChange?.h24) || 0,
                      priceChange1h: parseFloat(bestPair.priceChange?.h1) || 0,
                      age: pairAge,
                      isNew: true,
                    });
                  }
                }
              } catch (err) {
                // ادامه
              }
            }
          }
        }
      }
    }
    
  } catch (err) {
    console.error('⚠️ خطا:', err.message);
  }
  
  const uniqueTokens = [];
  const seen = new Set();
  
  for (const token of tokens) {
    const key = token.pairAddress;
    if (!seen.has(key) && !boughtTokens.has(key)) { // چک نشده توسط boughtTokens
      seen.add(key);
      uniqueTokens.push(token);
    }
  }
  
  return uniqueTokens;
}

function analyzeToken(token) {
  const scores = {
    liquidity: 0,
    volume: 0,
    priceAction: 0,
    age: 0,
    total: 0,
  };
  
  const liq = token.liquidity || 0;
  if (liq > 50000) scores.liquidity = 20;
  else if (liq > 10000) scores.liquidity = 16;
  else if (liq > 5000) scores.liquidity = 12;
  else if (liq > 1000) scores.liquidity = 8;
  else if (liq > 300) scores.liquidity = 4;
  
  const vol = token.volume24h || 0;
  if (vol > 100000) scores.volume = 20;
  else if (vol > 50000) scores.volume = 16;
  else if (vol > 10000) scores.volume = 12;
  else if (vol > 1000) scores.volume = 8;
  else if (vol > 50) scores.volume = 4;
  
  const priceChange1h = token.priceChange1h || 0;
  const priceChange24h = token.priceChange24h || 0;
  const bestChange = Math.max(priceChange1h, priceChange24h);
  
  if (bestChange > 200) scores.priceAction = 30;
  else if (bestChange > 100) scores.priceAction = 25;
  else if (bestChange > 50) scores.priceAction = 20;
  else if (bestChange > 20) scores.priceAction = 15;
  else if (bestChange > 10) scores.priceAction = 10;
  else if (bestChange > 0) scores.priceAction = 5;
  
  const age = token.age || 999;
  if (age < 3) scores.age = 15;
  else if (age < 10) scores.age = 12;
  else if (age < 30) scores.age = 9;
  else if (age < 60) scores.age = 6;
  
  scores.total = scores.liquidity + scores.volume + scores.priceAction + scores.age;
  
  const isPumping = bestChange > CONFIG.PUMP_THRESHOLD && vol > 500;
  const hasGoodLiquidity = liq >= CONFIG.MIN_LIQUIDITY;
  
  // شرایط آسان‌تر برای خرید
  const shouldBuy = (
    (scores.total >= CONFIG.AUTO_BUY_SCORE_THRESHOLD || isPumping) &&
    hasGoodLiquidity &&
    age <= CONFIG.MAX_TOKEN_AGE &&
    !boughtTokens.has(token.pairAddress)
  );
  
  const reasons = [];
  if (isPumping) reasons.push('🔥 PUMPING');
  if (token.isNew || age < 3) reasons.push('⚡ NEW');
  if (scores.liquidity >= 12) reasons.push('💧 LIQ OK');
  if (scores.volume >= 12) reasons.push('📊 VOL OK');
  if (scores.priceAction >= 15) reasons.push('📈 UP');
  
  return {
    shouldBuy,
    isPumping,
    score: scores.total,
    breakdown: scores,
    reasons: reasons.join(' | ') || '—',
  };
}

async function buyToken(token) {
  const price = token.price || 0;
  if (!price || price <= 0) {
    console.log(`⚠️ قیمت نامعتبر: ${token.symbol}`);
    return null;
  }
  
  const amount = stats.capital * CONFIG.POSITION_SIZE;
  if (stats.capital < amount) {
    console.log(`⚠️ سرمایه کافی نیست`);
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
  boughtTokens.add(token.pairAddress); // اضافه کردن به لیست
  stats.capital -= amount;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🟢 BOUGHT: ${position.symbol}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`💵 Price: $${price.toFixed(8)}`);
  console.log(`📦 Amount: $${amount.toFixed(2)}`);
  console.log(`💧 Liquidity: $${(token.liquidity || 0).toFixed(0)}`);
  console.log(`📊 Volume: $${(token.volume24h || 0).toFixed(0)}`);
  console.log(`🎯 Score: ${token.score || 0}/100`);
  console.log(`${token.reasons || ''}`);
  console.log(`${'='.repeat(60)}\n`);
  
  saveData();
  return position;
}

async function checkAndSell() {
  if (activePositions.length === 0) return;
  
  for (let i = activePositions.length - 1; i >= 0; i--) {
    const pos = activePositions[i];
    pos.checkCount = (pos.checkCount || 0) + 1;
    
    try {
      const res = await fetch(
        `https://api.dexscreener.com/latest/dex/pairs/solana/${pos.pairAddress}`,
        { timeout: 3000 }
      );
      
      if (!res.ok) continue;
      
      const data = await res.json();
      if (!data.pair || !data.pair.priceUsd) continue;
      
      const currentPrice = parseFloat(data.pair.priceUsd);
      if (!currentPrice || currentPrice <= 0) continue;
      
      if (currentPrice > pos.highestPrice) pos.highestPrice = currentPrice;
      if (currentPrice < pos.lowestPrice) pos.lowestPrice = currentPrice;
      
      const currentValue = pos.quantity * currentPrice;
      const profit = currentValue - pos.investedAmount;
      const profitPercent = profit / pos.investedAmount;
      
      console.log(`  📊 ${pos.symbol}: P/L ${(profitPercent * 100).toFixed(1)}%`);
      
      let shouldSell = false;
      let reason = '';
      
      if (profitPercent >= CONFIG.TAKE_PROFIT) {
        shouldSell = true;
        reason = `🎯 TARGET +${(profitPercent * 100).toFixed(1)}%`;
      } else if (profitPercent <= -CONFIG.STOP_LOSS) {
        shouldSell = true;
        reason = `🛑 STOP LOSS ${(profitPercent * 100).toFixed(1)}%`;
      }
      
      const dropFromATH = (pos.highestPrice - currentPrice) / pos.highestPrice;
      if (dropFromATH > 0.15 && profitPercent > 0.05) {
        shouldSell = true;
        reason = `📉 TRAILING +${(profitPercent * 100).toFixed(1)}%`;
      }
      
      if (pos.checkCount > 60 && profitPercent > 0) {
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
        console.log(`💵 Buy: $${pos.buyPrice.toFixed(8)} → Sell: $${currentPrice.toFixed(8)}`);
        console.log(`💰 P/L: $${profit.toFixed(2)} (${(profitPercent * 100).toFixed(1)}%)`);
        console.log(`⏱️ ${duration.toFixed(0)}s | ${reason}`);
        console.log(`${'='.repeat(60)}\n`);
        
        activePositions.splice(i, 1);
        saveData();
      }
      
    } catch (err) {
      console.error(`⚠️ Error: ${pos.symbol} - ${err.message}`);
    }
  }
}

async function mainLoop() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 MEMECOIN TRADING BOT - AGGRESSIVE MODE');
  console.log('='.repeat(70));
  console.log(`💰 Capital: $${CONFIG.CAPITAL}`);
  console.log(`🎯 TP: ${CONFIG.TAKE_PROFIT * 100}% | SL: ${CONFIG.STOP_LOSS * 100}%`);
  console.log(`📊 Auto-buy: ${CONFIG.AUTO_BUY_SCORE_THRESHOLD}+ score`);
  console.log('='.repeat(70) + '\n');
  
  loadData();
  
  let lastHourLog = new Date().getHours();
  let checkCount = 0;
  
  setInterval(async () => {
    try {
      checkCount++;
      
      if (activePositions.length > 0) {
        await checkAndSell();
      }
      
      if (checkCount % 4 === 0 && 
          activePositions.length < CONFIG.MAX_POSITIONS && 
          stats.capital > 1.5) {
        
        console.log(`\n🔍 Scan #${Math.floor(checkCount/4)} (Capital: $${stats.capital.toFixed(2)})`);
        
        const tokens = await getNewTokens();
        stats.scannedTokens += tokens.length;
        
        if (tokens.length > 0) {
          console.log(`✅ Found ${tokens.length} NEW tokens`);
          
          const analyzed = tokens
            .map(token => ({ ...token, ...analyzeToken(token) }))
            .sort((a, b) => b.score - a.score);
          
          console.log('\n📊 Top 5:');
          analyzed.slice(0, 5).forEach((t, i) => {
            console.log(`  ${i+1}. ${t.symbol} - ${t.score}/100 ${t.shouldBuy ? '✅' : ''} - ${t.reasons}`);
          });
          
          for (const token of analyzed) {
            if (token.shouldBuy && !boughtTokens.has(token.pairAddress)) {
              console.log(`\n🎯 BUYING NOW!`);
              await buyToken(token);
              break;
            }
          }
        }
        
        if (boughtTokens.size > 100) {
          boughtTokens.clear();
          console.log('🧹 Cache cleared');
        }
      }
      
      const currentHour = new Date().getHours();
      if (currentHour !== lastHourLog) {
        const wr = stats.totalTrades > 0 ? (stats.wins/stats.totalTrades*100).toFixed(1) : 0;
        const roi = ((stats.capital - CONFIG.CAPITAL) / CONFIG.CAPITAL * 100).toFixed(2);
        
        console.log(`\n${'='.repeat(70)}`);
        console.log(`📊 REPORT ${new Date().toLocaleTimeString()}`);
        console.log(`💰 Cap: $${stats.capital.toFixed(2)} | ROI: ${roi}%`);
        console.log(`📈 Trades: ${stats.totalTrades} | W/L: ${stats.wins}/${stats.losses} (${wr}%)`);
        console.log(`💵 P/L: $${stats.totalProfit.toFixed(2)} | Active: ${activePositions.length}`);
        console.log(`${'='.repeat(70)}\n`);
        
        lastHourLog = currentHour;
        saveData();
      }
      
    } catch (err) {
      console.error('❌ Error:', err.message);
    }
  }, CONFIG.CHECK_INTERVAL);
}

console.log('🚀 Starting...');
mainLoop();

process.on('uncaughtException', (err) => {
  console.error('❌ Exception:', err);
  saveData();
});

module.exports = { trades, activePositions, stats, saveData };
