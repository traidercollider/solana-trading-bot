// 🚀 FIXED BOT - فیلتر میم‌کوین + خرید واقعی
const fetch = require('node-fetch');
const fs = require('fs');

const CONFIG = {
  CAPITAL: 10,
  TAKE_PROFIT: 0.50,
  STOP_LOSS: 0.20,
  CHECK_INTERVAL: 500,
  MAX_POSITIONS: 5,
  POSITION_SIZE: 0.15,
  MIN_SCORE: 20, // خیلی پایین!
  MIN_LIQUIDITY: 200,
  MIN_VOLUME: 50,
  MAX_AGE: 120, // 2 دقیقه
};

let trades = [];
let activePositions = [];
let boughtTokens = new Set();

let stats = {
  totalTrades: 0,
  wins: 0,
  losses: 0,
  totalProfit: 0,
  capital: CONFIG.CAPITAL,
  startTime: Date.now(),
};

function saveData() {
  fs.writeFileSync('trading_data.json', JSON.stringify({
    trades, activePositions, stats, lastUpdate: new Date().toISOString()
  }, null, 2));
  console.log('💾 Saved');
}

function loadData() {
  try {
    if (fs.existsSync('trading_data.json')) {
      const data = JSON.parse(fs.readFileSync('trading_data.json', 'utf8'));
      trades = data.trades || [];
      activePositions = data.activePositions || [];
      stats = data.stats || stats;
      activePositions.forEach(p => boughtTokens.add(p.pairAddress));
      trades.forEach(t => boughtTokens.add(t.pairAddress));
      console.log(`✅ Loaded: ${trades.length} trades, ${activePositions.length} active`);
    }
  } catch (err) {
    console.log('⚠️ Fresh start');
  }
}

async function getTokens() {
  const tokens = [];
  
  try {
    // فقط توکن‌های جدید Raydium
    const res = await fetch('https://api.dexscreener.com/latest/dex/pairs/solana/raydium', {
      timeout: 3000,
      headers: { 'User-Agent': 'Bot/1.0' }
    });
    
    if (res.ok) {
      const data = await res.json();
      
      if (data.pairs) {
        console.log(`📡 API returned ${data.pairs.length} Raydium pairs`);
        
        data.pairs.forEach(p => {
          // فیلتر: فقط توکن‌هایی که SOL/USDC نیستند
          const symbol = p.baseToken?.symbol || '';
          const isNotSol = symbol !== 'SOL' && symbol !== 'USDC' && symbol !== 'WSOL';
          
          if (isNotSol && p.chainId === 'solana' && p.baseToken?.address && p.pairAddress && p.priceUsd) {
            const age = p.pairCreatedAt ? (Date.now() - p.pairCreatedAt) / 1000 : 999;
            
            tokens.push({
              address: p.baseToken.address,
              symbol: symbol,
              name: p.baseToken.name || symbol,
              pairAddress: p.pairAddress,
              price: parseFloat(p.priceUsd),
              liquidity: parseFloat(p.liquidity?.usd) || 0,
              volume24h: parseFloat(p.volume?.h24) || 0,
              priceChange24h: parseFloat(p.priceChange?.h24) || 0,
              priceChange1h: parseFloat(p.priceChange?.h1) || 0,
              age,
            });
          }
        });
        
        console.log(`✅ Filtered to ${tokens.length} memecoins (excluded SOL/USDC)`);
      }
    }
  } catch (err) {
    console.error('⚠️ API Error:', err.message);
  }
  
  // حذف توکن‌هایی که قبلاً خریدیم
  return tokens.filter(t => !boughtTokens.has(t.pairAddress));
}

function analyze(token) {
  let score = 0;
  
  const liq = token.liquidity || 0;
  const vol = token.volume24h || 0;
  const pc24 = token.priceChange24h || 0;
  const pc1 = token.priceChange1h || 0;
  const age = token.age || 999;
  
  // نقدینگی (0-20)
  if (liq > 50000) score += 20;
  else if (liq > 10000) score += 15;
  else if (liq > 5000) score += 12;
  else if (liq > 1000) score += 8;
  else if (liq > 200) score += 5;
  
  // حجم (0-20)
  if (vol > 100000) score += 20;
  else if (vol > 50000) score += 15;
  else if (vol > 10000) score += 12;
  else if (vol > 1000) score += 8;
  else if (vol > 50) score += 5;
  
  // تغییر قیمت (0-30)
  const bestChange = Math.max(pc1, pc24);
  if (bestChange > 200) score += 30;
  else if (bestChange > 100) score += 25;
  else if (bestChange > 50) score += 20;
  else if (bestChange > 20) score += 15;
  else if (bestChange > 5) score += 10;
  else if (bestChange > 0) score += 5;
  
  // سن (0-10)
  if (age < 5) score += 10;
  else if (age < 30) score += 8;
  else if (age < 60) score += 6;
  else if (age < 120) score += 4;
  
  // شرایط خرید - خیلی ساده!
  const shouldBuy = 
    score >= CONFIG.MIN_SCORE && 
    liq >= CONFIG.MIN_LIQUIDITY &&
    vol >= CONFIG.MIN_VOLUME &&
    age <= CONFIG.MAX_AGE &&
    !boughtTokens.has(token.pairAddress);
  
  return { score, shouldBuy };
}

async function buy(token) {
  if (!token.price || token.price <= 0) {
    console.log(`⚠️ Invalid price for ${token.symbol}`);
    return null;
  }
  
  const amount = stats.capital * CONFIG.POSITION_SIZE;
  if (stats.capital < amount) {
    console.log(`⚠️ Not enough capital`);
    return null;
  }
  
  const pos = {
    id: Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    token: token.name,
    symbol: token.symbol,
    address: token.address,
    pairAddress: token.pairAddress,
    buyPrice: token.price,
    quantity: amount / token.price,
    investedAmount: amount,
    buyTime: new Date().toISOString(),
    highestPrice: token.price,
    lowestPrice: token.price,
    checkCount: 0,
  };
  
  activePositions.push(pos);
  boughtTokens.add(token.pairAddress);
  stats.capital -= amount;
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🟢 BOUGHT: ${pos.symbol}`);
  console.log(`${'='.repeat(70)}`);
  console.log(`💵 Price: $${token.price.toFixed(8)}`);
  console.log(`📦 Amount: $${amount.toFixed(2)} (${pos.quantity.toFixed(2)} tokens)`);
  console.log(`💧 Liquidity: $${token.liquidity.toFixed(0)}`);
  console.log(`📊 Volume 24h: $${token.volume24h.toFixed(0)}`);
  console.log(`📈 Change 24h: ${token.priceChange24h?.toFixed(1) || 0}%`);
  console.log(`🎯 Score: ${token.score} points`);
  console.log(`⏱️ Age: ${token.age.toFixed(1)}s`);
  console.log(`${'='.repeat(70)}\n`);
  
  saveData();
  return pos;
}

async function checkSell() {
  if (activePositions.length === 0) return;
  
  for (let i = activePositions.length - 1; i >= 0; i--) {
    const pos = activePositions[i];
    pos.checkCount++;
    
    try {
      const res = await fetch(
        `https://api.dexscreener.com/latest/dex/pairs/solana/${pos.pairAddress}`,
        { timeout: 3000 }
      );
      
      if (!res.ok) continue;
      
      const data = await res.json();
      if (!data.pair?.priceUsd) continue;
      
      const price = parseFloat(data.pair.priceUsd);
      if (price <= 0) continue;
      
      if (price > pos.highestPrice) pos.highestPrice = price;
      if (price < pos.lowestPrice) pos.lowestPrice = price;
      
      const value = pos.quantity * price;
      const profit = value - pos.investedAmount;
      const profitPct = profit / pos.investedAmount;
      
      console.log(`  📊 ${pos.symbol}: ${(profitPct * 100).toFixed(1)}% (check ${pos.checkCount})`);
      
      let sell = false;
      let reason = '';
      
      // Take profit
      if (profitPct >= CONFIG.TAKE_PROFIT) {
        sell = true;
        reason = `🎯 TARGET +${(profitPct * 100).toFixed(1)}%`;
      }
      // Stop loss
      else if (profitPct <= -CONFIG.STOP_LOSS) {
        sell = true;
        reason = `🛑 STOP LOSS ${(profitPct * 100).toFixed(1)}%`;
      }
      // Time exit (60 checks = 30 seconds)
      else if (pos.checkCount > 60 && profitPct > 0) {
        sell = true;
        reason = `⏰ TIME EXIT +${(profitPct * 100).toFixed(1)}%`;
      }
      
      // Trailing stop
      const drop = (pos.highestPrice - price) / pos.highestPrice;
      if (drop > 0.15 && profitPct > 0.05) {
        sell = true;
        reason = `📉 TRAILING STOP +${(profitPct * 100).toFixed(1)}%`;
      }
      
      if (sell) {
        const duration = (Date.now() - new Date(pos.buyTime)) / 1000;
        
        const trade = {
          ...pos,
          sellPrice: price,
          sellTime: new Date().toISOString(),
          profit,
          profitPercent: profitPct * 100,
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
        
        console.log(`\n${'='.repeat(70)}`);
        console.log(`${profit > 0 ? '✅ WIN' : '❌ LOSS'}: ${pos.symbol}`);
        console.log(`${'='.repeat(70)}`);
        console.log(`💵 Buy: $${pos.buyPrice.toFixed(8)} → Sell: $${price.toFixed(8)}`);
        console.log(`💰 P/L: $${profit.toFixed(2)} (${(profitPct * 100).toFixed(1)}%)`);
        console.log(`📊 ATH: $${pos.highestPrice.toFixed(8)}`);
        console.log(`⏱️ Duration: ${duration.toFixed(0)}s`);
        console.log(`${reason}`);
        console.log(`${'='.repeat(70)}\n`);
        
        activePositions.splice(i, 1);
        saveData();
      }
    } catch (err) {
      console.error(`⚠️ Error checking ${pos.symbol}:`, err.message);
    }
  }
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 MEMECOIN TRADING BOT - FIXED VERSION');
  console.log('='.repeat(70));
  console.log(`💰 Capital: $${CONFIG.CAPITAL}`);
  console.log(`🎯 Min Score: ${CONFIG.MIN_SCORE} (auto-buy if met)`);
  console.log(`💧 Min Liquidity: $${CONFIG.MIN_LIQUIDITY}`);
  console.log(`📊 Min Volume: $${CONFIG.MIN_VOLUME}`);
  console.log(`⏱️ Max Age: ${CONFIG.MAX_AGE}s`);
  console.log(`🚫 Filtering out: SOL, USDC, WSOL`);
  console.log('='.repeat(70) + '\n');
  
  loadData();
  
  let count = 0;
  let lastHour = new Date().getHours();
  
  setInterval(async () => {
    try {
      count++;
      
      // Check active positions every cycle
      if (activePositions.length > 0) {
        await checkSell();
      }
      
      // Search for new tokens every 4 cycles (2 seconds)
      if (count % 4 === 0 && 
          activePositions.length < CONFIG.MAX_POSITIONS && 
          stats.capital > 1.5) {
        
        console.log(`\n🔍 Scan #${Math.floor(count/4)} (Capital: $${stats.capital.toFixed(2)}, Active: ${activePositions.length})`);
        
        const tokens = await getTokens();
        
        if (tokens.length > 0) {
          const analyzed = tokens
            .map(t => ({ ...t, ...analyze(t) }))
            .sort((a, b) => b.score - a.score);
          
          console.log(`\nTop 5 Memecoins:`);
          analyzed.slice(0, 5).forEach((t, i) => {
            console.log(`  ${i+1}. ${t.symbol} - ${t.score} pts ${t.shouldBuy ? '✅ BUY' : '❌'} | Liq: $${t.liquidity.toFixed(0)} | Vol: $${t.volume24h.toFixed(0)}`);
          });
          
          // Buy first eligible token
          for (const token of analyzed) {
            if (token.shouldBuy) {
              console.log(`\n🎯 BUYING NOW: ${token.symbol}`);
              await buy(token);
              break; // Only buy one per scan
            }
          }
          
          if (!analyzed.some(t => t.shouldBuy)) {
            console.log(`⚠️ No tokens met criteria (score >= ${CONFIG.MIN_SCORE})`);
          }
        } else {
          console.log('⚠️ No new memecoins found (all previously seen)');
        }
        
        // Clear cache periodically
        if (boughtTokens.size > 200) {
          const oldSize = boughtTokens.size;
          boughtTokens.clear();
          console.log(`🧹 Cache cleared (${oldSize} tokens)`);
        }
      }
      
      // Hourly report
      const h = new Date().getHours();
      if (h !== lastHour) {
        const wr = stats.totalTrades > 0 ? (stats.wins / stats.totalTrades * 100).toFixed(1) : 0;
        const roi = ((stats.capital - CONFIG.CAPITAL) / CONFIG.CAPITAL * 100).toFixed(2);
        const runtime = ((Date.now() - stats.startTime) / 3600000).toFixed(1);
        
        console.log(`\n${'='.repeat(70)}`);
        console.log(`📊 HOURLY REPORT - ${new Date().toLocaleTimeString()}`);
        console.log(`${'='.repeat(70)}`);
        console.log(`⏱️ Runtime: ${runtime}h`);
        console.log(`💰 Capital: $${stats.capital.toFixed(2)} (ROI: ${roi}%)`);
        console.log(`📈 Trades: ${stats.totalTrades} | W/L: ${stats.wins}/${stats.losses} (${wr}% WR)`);
        console.log(`💵 Total P/L: $${stats.totalProfit.toFixed(2)}`);
        console.log(`💼 Active Positions: ${activePositions.length}`);
        console.log(`${'='.repeat(70)}\n`);
        
        lastHour = h;
        saveData();
      }
      
    } catch (err) {
      console.error('❌ Main loop error:', err.message);
    }
  }, CONFIG.CHECK_INTERVAL);
}

console.log('🚀 Starting bot...');
main();

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught:', err);
  saveData();
});

module.exports = { trades, activePositions, stats };
