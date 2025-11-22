// 🚀 SUPER AGGRESSIVE BOT - خرید قطعی!
const fetch = require('node-fetch');
const fs = require('fs');

const CONFIG = {
  CAPITAL: 10,
  TAKE_PROFIT: 0.50,
  STOP_LOSS: 0.20,
  CHECK_INTERVAL: 500,
  MAX_POSITIONS: 5,
  POSITION_SIZE: 0.15,
  
  // تنظیمات خیلی آسان برای خرید
  MIN_SCORE: 25, // فقط 25 امتیاز کافیه!
  MIN_LIQUIDITY: 200, // فقط 200$
  MIN_VOLUME: 10, // فقط 10$!
  MAX_AGE: 60, // تا 60 ثانیه!
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
      console.log('✅ Data loaded');
    }
  } catch (err) {
    console.log('⚠️ Fresh start');
  }
}

async function getTokens() {
  const tokens = [];
  
  try {
    const res = await fetch('https://api.dexscreener.com/latest/dex/search?q=SOL', {
      timeout: 3000,
      headers: { 'User-Agent': 'Bot/1.0' }
    });
    
    if (res.ok) {
      const data = await res.json();
      
      if (data.pairs) {
        data.pairs.forEach(p => {
          if (p.chainId === 'solana' && p.baseToken?.address && p.pairAddress && p.priceUsd) {
            const age = p.pairCreatedAt ? (Date.now() - p.pairCreatedAt) / 1000 : 999;
            
            tokens.push({
              address: p.baseToken.address,
              symbol: p.baseToken.symbol || 'TOKEN',
              name: p.baseToken.name || 'Token',
              pairAddress: p.pairAddress,
              price: parseFloat(p.priceUsd),
              liquidity: parseFloat(p.liquidity?.usd) || 0,
              volume24h: parseFloat(p.volume?.h24) || 0,
              priceChange24h: parseFloat(p.priceChange?.h24) || 0,
              age,
            });
          }
        });
      }
    }
  } catch (err) {
    console.error('⚠️', err.message);
  }
  
  return tokens.filter(t => !boughtTokens.has(t.pairAddress));
}

function analyze(token) {
  let score = 0;
  
  // نقدینگی
  if (token.liquidity > 10000) score += 15;
  else if (token.liquidity > 1000) score += 10;
  else if (token.liquidity > 200) score += 5;
  
  // حجم
  if (token.volume24h > 10000) score += 15;
  else if (token.volume24h > 1000) score += 10;
  else if (token.volume24h > 10) score += 5;
  
  // قیمت
  const pc = token.priceChange24h || 0;
  if (pc > 100) score += 20;
  else if (pc > 50) score += 15;
  else if (pc > 10) score += 10;
  else if (pc > 0) score += 5;
  
  // سن
  if (token.age < 10) score += 10;
  else if (token.age < 60) score += 5;
  
  const shouldBuy = 
    score >= CONFIG.MIN_SCORE && 
    token.liquidity >= CONFIG.MIN_LIQUIDITY &&
    token.volume24h >= CONFIG.MIN_VOLUME &&
    token.age <= CONFIG.MAX_AGE &&
    !boughtTokens.has(token.pairAddress);
  
  return { score, shouldBuy };
}

async function buy(token) {
  if (!token.price || token.price <= 0) return null;
  
  const amount = stats.capital * CONFIG.POSITION_SIZE;
  if (stats.capital < amount) return null;
  
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
  console.log(`💵 $${token.price.toFixed(8)} | Amount: $${amount.toFixed(2)}`);
  console.log(`💧 Liq: $${token.liquidity.toFixed(0)} | Vol: $${token.volume24h.toFixed(0)}`);
  console.log(`🎯 Score: ${token.score} | Age: ${token.age.toFixed(1)}s`);
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
      
      console.log(`  ${pos.symbol}: ${(profitPct * 100).toFixed(1)}%`);
      
      let sell = false;
      let reason = '';
      
      if (profitPct >= CONFIG.TAKE_PROFIT) {
        sell = true;
        reason = `TARGET +${(profitPct * 100).toFixed(1)}%`;
      } else if (profitPct <= -CONFIG.STOP_LOSS) {
        sell = true;
        reason = `STOP ${(profitPct * 100).toFixed(1)}%`;
      } else if (pos.checkCount > 60 && profitPct > 0) {
        sell = true;
        reason = `TIME +${(profitPct * 100).toFixed(1)}%`;
      }
      
      const drop = (pos.highestPrice - price) / pos.highestPrice;
      if (drop > 0.15 && profitPct > 0.05) {
        sell = true;
        reason = `TRAILING +${(profitPct * 100).toFixed(1)}%`;
      }
      
      if (sell) {
        const trade = {
          ...pos,
          sellPrice: price,
          sellTime: new Date().toISOString(),
          profit,
          profitPercent: profitPct * 100,
          duration: (Date.now() - new Date(pos.buyTime)) / 1000,
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
        console.log(`💵 $${pos.buyPrice.toFixed(8)} → $${price.toFixed(8)}`);
        console.log(`💰 ${profit > 0 ? '+' : ''}$${profit.toFixed(2)} (${(profitPct * 100).toFixed(1)}%)`);
        console.log(`${reason}`);
        console.log(`${'='.repeat(70)}\n`);
        
        activePositions.splice(i, 1);
        saveData();
      }
    } catch (err) {
      console.error(`⚠️ ${pos.symbol}:`, err.message);
    }
  }
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 SUPER AGGRESSIVE BOT');
  console.log('='.repeat(70));
  console.log(`💰 Capital: $${CONFIG.CAPITAL}`);
  console.log(`🎯 Min Score: ${CONFIG.MIN_SCORE} (VERY LOW!)`);
  console.log(`💧 Min Liq: $${CONFIG.MIN_LIQUIDITY}`);
  console.log(`📊 Min Vol: $${CONFIG.MIN_VOLUME}`);
  console.log(`⏱️ Max Age: ${CONFIG.MAX_AGE}s`);
  console.log('='.repeat(70) + '\n');
  
  loadData();
  
  let count = 0;
  let lastHour = new Date().getHours();
  
  setInterval(async () => {
    try {
      count++;
      
      // چک فروش
      if (activePositions.length > 0) {
        await checkSell();
      }
      
      // جستجوی خرید
      if (count % 4 === 0 && 
          activePositions.length < CONFIG.MAX_POSITIONS && 
          stats.capital > 1.5) {
        
        console.log(`\n🔍 Scan ${Math.floor(count/4)} (Cap: $${stats.capital.toFixed(2)})`);
        
        const tokens = await getTokens();
        
        if (tokens.length > 0) {
          console.log(`✅ ${tokens.length} tokens found`);
          
          const analyzed = tokens
            .map(t => ({ ...t, ...analyze(t) }))
            .sort((a, b) => b.score - a.score);
          
          console.log('Top 3:');
          analyzed.slice(0, 3).forEach((t, i) => {
            console.log(`  ${i+1}. ${t.symbol} - ${t.score} pts ${t.shouldBuy ? '✅' : '❌'}`);
          });
          
          // خرید اولین گزینه مناسب
          for (const token of analyzed) {
            if (token.shouldBuy) {
              console.log(`\n🎯 BUYING: ${token.symbol} with ${token.score} points!`);
              await buy(token);
              break;
            }
          }
        } else {
          console.log('⚠️ No new tokens');
        }
        
        if (boughtTokens.size > 100) {
          boughtTokens.clear();
          console.log('🧹 Cache cleared');
        }
      }
      
      // گزارش ساعتی
      const h = new Date().getHours();
      if (h !== lastHour) {
        const wr = stats.totalTrades > 0 ? (stats.wins / stats.totalTrades * 100).toFixed(1) : 0;
        const roi = ((stats.capital - CONFIG.CAPITAL) / CONFIG.CAPITAL * 100).toFixed(2);
        
        console.log(`\n${'='.repeat(70)}`);
        console.log(`📊 REPORT ${h}:00`);
        console.log(`💰 $${stats.capital.toFixed(2)} | ROI: ${roi}%`);
        console.log(`📈 ${stats.totalTrades} trades | ${stats.wins}W / ${stats.losses}L (${wr}%)`);
        console.log(`💵 P/L: $${stats.totalProfit.toFixed(2)} | Active: ${activePositions.length}`);
        console.log(`${'='.repeat(70)}\n`);
        
        lastHour = h;
        saveData();
      }
      
    } catch (err) {
      console.error('❌', err.message);
    }
  }, CONFIG.CHECK_INTERVAL);
}

console.log('🚀 Starting SUPER AGGRESSIVE BOT...');
main();

module.exports = { trades, activePositions, stats };
