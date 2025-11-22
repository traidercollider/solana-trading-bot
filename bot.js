// 🚀 INSTANT BUY BOT - خرید فوری توکن‌های جدید
const fetch = require('node-fetch');
const fs = require('fs');

const CONFIG = {
  CAPITAL: 10,
  TAKE_PROFIT: 0.50, // 50% سود
  STOP_LOSS: 0.20, // 20% ضرر
  CHECK_INTERVAL: 500, // 0.5 ثانیه
  
  // شرایط خرید خیلی ساده
  MAX_TOKEN_AGE: 2, // فقط زیر 2 ثانیه!
  MIN_LIQUIDITY: 100, // حداقل 100$ نقدینگی
  MAX_POSITIONS: 5, // حداکثر 5 پوزیشن همزمان
  POSITION_SIZE: 0.20, // 20% سرمایه در هر خرید
};

let trades = [];
let activePositions = [];
let boughtPairs = new Set(); // فقط pair هایی که الان خریدیم

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
      
      // فقط پوزیشن‌های فعال رو به cache اضافه کن
      activePositions.forEach(p => boughtPairs.add(p.pairAddress));
      
      console.log(`✅ Loaded: ${trades.length} trades, ${activePositions.length} active`);
    }
  } catch (err) {
    console.log('⚠️ Fresh start');
  }
}

async function getNewTokens() {
  const tokens = [];
  const now = Date.now();
  
  try {
    // DexScreener - جستجوی SOL pairs
    const res = await fetch('https://api.dexscreener.com/latest/dex/search?q=SOL', {
      timeout: 3000,
      headers: { 'User-Agent': 'Bot/2.0' }
    });
    
    if (res.ok) {
      const data = await res.json();
      
      if (data.pairs) {
        console.log(`📡 Found ${data.pairs.length} total pairs`);
        
        data.pairs.forEach(p => {
          const symbol = p.baseToken?.symbol || '';
          const isNotStable = symbol !== 'SOL' && symbol !== 'USDC' && symbol !== 'WSOL' && symbol !== 'USDT';
          
          if (isNotStable && 
              p.chainId === 'solana' && 
              p.baseToken?.address && 
              p.pairAddress && 
              p.priceUsd &&
              p.pairCreatedAt) {
            
            const ageSeconds = (now - p.pairCreatedAt) / 1000;
            
            tokens.push({
              address: p.baseToken.address,
              symbol: symbol,
              name: p.baseToken.name || symbol,
              pairAddress: p.pairAddress,
              price: parseFloat(p.priceUsd),
              liquidity: parseFloat(p.liquidity?.usd) || 0,
              volume24h: parseFloat(p.volume?.h24) || 0,
              priceChange24h: parseFloat(p.priceChange?.h24) || 0,
              age: ageSeconds,
              createdAt: new Date(p.pairCreatedAt).toISOString(),
            });
          }
        });
        
        console.log(`✅ Filtered: ${tokens.length} memecoins`);
      }
    }
  } catch (err) {
    console.error('⚠️ API Error:', err.message);
  }
  
  return tokens;
}

function shouldBuy(token) {
  // شرایط خیلی ساده:
  // 1. عمر کمتر از 2 ثانیه
  // 2. نقدینگی بیشتر از 100$
  // 3. قبلاً نخریدیم
  
  const isNew = token.age <= CONFIG.MAX_TOKEN_AGE;
  const hasLiquidity = token.liquidity >= CONFIG.MIN_LIQUIDITY;
  const notBought = !boughtPairs.has(token.pairAddress);
  
  const canBuy = isNew && hasLiquidity && notBought;
  
  if (isNew && !canBuy) {
    console.log(`  ⚠️ ${token.symbol}: age=${token.age.toFixed(2)}s, liq=$${token.liquidity.toFixed(0)}, bought=${!notBought}`);
  }
  
  return canBuy;
}

async function buy(token) {
  if (!token.price || token.price <= 0) {
    console.log(`⚠️ Invalid price: ${token.symbol}`);
    return null;
  }
  
  const amount = stats.capital * CONFIG.POSITION_SIZE;
  if (stats.capital < amount) {
    console.log(`⚠️ Not enough capital (${stats.capital.toFixed(2)} < ${amount.toFixed(2)})`);
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
  boughtPairs.add(token.pairAddress);
  stats.capital -= amount;
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🟢 INSTANT BUY: ${pos.symbol}`);
  console.log(`${'='.repeat(70)}`);
  console.log(`💵 Price: $${token.price.toFixed(10)}`);
  console.log(`📦 Amount: $${amount.toFixed(2)} (${pos.quantity.toFixed(2)} tokens)`);
  console.log(`💧 Liquidity: $${token.liquidity.toFixed(0)}`);
  console.log(`⏱️ Age: ${token.age.toFixed(3)}s (FRESH!)`);
  console.log(`🕐 Created: ${token.createdAt}`);
  console.log(`💰 Remaining Capital: $${stats.capital.toFixed(2)}`);
  console.log(`${'='.repeat(70)}\n`);
  
  saveData();
  return pos;
}

async function checkSell() {
  if (activePositions.length === 0) return;
  
  console.log(`\n🔍 Checking ${activePositions.length} positions...`);
  
  for (let i = activePositions.length - 1; i >= 0; i--) {
    const pos = activePositions[i];
    pos.checkCount++;
    
    try {
      const res = await fetch(
        `https://api.dexscreener.com/latest/dex/pairs/solana/${pos.pairAddress}`,
        { timeout: 3000 }
      );
      
      if (!res.ok) {
        console.log(`  ⚠️ ${pos.symbol}: HTTP ${res.status}`);
        continue;
      }
      
      const data = await res.json();
      if (!data.pair?.priceUsd) {
        console.log(`  ⚠️ ${pos.symbol}: No price data`);
        continue;
      }
      
      const price = parseFloat(data.pair.priceUsd);
      if (price <= 0) continue;
      
      if (price > pos.highestPrice) pos.highestPrice = price;
      if (price < pos.lowestPrice) pos.lowestPrice = price;
      
      const value = pos.quantity * price;
      const profit = value - pos.investedAmount;
      const profitPct = profit / pos.investedAmount;
      
      console.log(`  📊 ${pos.symbol}: ${(profitPct * 100).toFixed(1)}% | ATH: ${(pos.highestPrice/pos.buyPrice*100-100).toFixed(1)}% | Checks: ${pos.checkCount}`);
      
      let sell = false;
      let reason = '';
      
      // Take profit: 50%
      if (profitPct >= CONFIG.TAKE_PROFIT) {
        sell = true;
        reason = `🎯 TARGET HIT +${(profitPct * 100).toFixed(1)}%`;
      }
      // Stop loss: 20%
      else if (profitPct <= -CONFIG.STOP_LOSS) {
        sell = true;
        reason = `🛑 STOP LOSS ${(profitPct * 100).toFixed(1)}%`;
      }
      // Trailing stop: اگر از ATH بیش از 15% افتاد
      else {
        const drop = (pos.highestPrice - price) / pos.highestPrice;
        if (drop > 0.15 && profitPct > 0.05) {
          sell = true;
          reason = `📉 TRAILING STOP +${(profitPct * 100).toFixed(1)}% (dropped ${(drop*100).toFixed(1)}% from ATH)`;
        }
      }
      
      // Time-based exit: بعد از 60 چک (30 ثانیه) اگر سود داشت بفروش
      if (!sell && pos.checkCount >= 60 && profitPct > 0.02) {
        sell = true;
        reason = `⏰ TIME EXIT +${(profitPct * 100).toFixed(1)}% (secured profit)`;
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
        console.log(`💵 Buy: $${pos.buyPrice.toFixed(10)} → Sell: $${price.toFixed(10)}`);
        console.log(`💰 P/L: $${profit.toFixed(2)} (${(profitPct * 100).toFixed(1)}%)`);
        console.log(`📊 ATH: $${pos.highestPrice.toFixed(10)} (+${((pos.highestPrice/pos.buyPrice-1)*100).toFixed(1)}%)`);
        console.log(`⏱️ Duration: ${duration.toFixed(1)}s`);
        console.log(`💰 New Capital: $${stats.capital.toFixed(2)}`);
        console.log(`${reason}`);
        console.log(`${'='.repeat(70)}\n`);
        
        activePositions.splice(i, 1);
        boughtPairs.delete(pos.pairAddress); // حذف از cache تا بعداً بتونه دوباره بخره
        saveData();
      }
      
    } catch (err) {
      console.error(`  ⚠️ ${pos.symbol}: ${err.message}`);
    }
  }
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 INSTANT BUY BOT - Buy tokens under 2 seconds old');
  console.log('='.repeat(70));
  console.log(`💰 Capital: $${CONFIG.CAPITAL}`);
  console.log(`⏱️ Max Token Age: ${CONFIG.MAX_TOKEN_AGE}s (INSTANT!)`);
  console.log(`💧 Min Liquidity: $${CONFIG.MIN_LIQUIDITY}`);
  console.log(`🎯 Take Profit: ${CONFIG.TAKE_PROFIT * 100}%`);
  console.log(`🛑 Stop Loss: ${CONFIG.STOP_LOSS * 100}%`);
  console.log(`📦 Position Size: ${CONFIG.POSITION_SIZE * 100}%`);
  console.log(`🔄 Check Interval: ${CONFIG.CHECK_INTERVAL}ms`);
  console.log('='.repeat(70) + '\n');
  
  loadData();
  
  let scanCount = 0;
  let lastHour = new Date().getHours();
  
  setInterval(async () => {
    try {
      // چک پوزیشن‌های فعال در هر چرخه
      if (activePositions.length > 0) {
        await checkSell();
      }
      
      // جستجوی توکن‌های جدید هر 4 چرخه (2 ثانیه)
      if (scanCount % 4 === 0) {
        const canBuyMore = activePositions.length < CONFIG.MAX_POSITIONS;
        const hasCapital = stats.capital >= (CONFIG.CAPITAL * CONFIG.POSITION_SIZE);
        
        if (canBuyMore && hasCapital) {
          console.log(`\n${'='.repeat(70)}`);
          console.log(`🔍 SCAN #${Math.floor(scanCount/4)}`);
          console.log(`💰 Capital: $${stats.capital.toFixed(2)} | Active: ${activePositions.length}/${CONFIG.MAX_POSITIONS}`);
          console.log(`${'='.repeat(70)}`);
          
          const tokens = await getNewTokens();
          stats.scannedTokens += tokens.length;
          
          if (tokens.length > 0) {
            // مرتب‌سازی بر اساس سن (جدیدترین اول)
            const sorted = tokens.sort((a, b) => a.age - b.age);
            
            console.log(`\n🆕 Newest tokens:`);
            sorted.slice(0, 10).forEach((t, i) => {
              const canBuy = shouldBuy(t);
              console.log(`  ${i+1}. ${t.symbol} - ${t.age.toFixed(2)}s old - $${t.liquidity.toFixed(0)} liq ${canBuy ? '✅' : '❌'}`);
            });
            
            // خرید اولین توکن مناسب
            let bought = false;
            for (const token of sorted) {
              if (shouldBuy(token)) {
                console.log(`\n🎯 BUYING: ${token.symbol} (only ${token.age.toFixed(3)}s old!)`);
                await buy(token);
                bought = true;
                break;
              }
            }
            
            if (!bought) {
              const newest = sorted[0];
              console.log(`\n⚠️ No eligible tokens found!`);
              console.log(`   Newest: ${newest.symbol} (${newest.age.toFixed(2)}s) - Too old or already bought`);
            }
          } else {
            console.log('⚠️ No tokens found (API issue or all filtered out)');
          }
        } else {
          if (!canBuyMore) console.log(`⏸️ Max positions reached (${activePositions.length}/${CONFIG.MAX_POSITIONS})`);
          if (!hasCapital) console.log(`⏸️ Not enough capital ($${stats.capital.toFixed(2)})`);
        }
      }
      
      scanCount++;
      
      // گزارش ساعتی
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
        console.log(`💼 Active: ${activePositions.length} | Scanned: ${stats.scannedTokens}`);
        console.log(`${'='.repeat(70)}\n`);
        
        lastHour = h;
        saveData();
      }
      
    } catch (err) {
      console.error('❌ Main loop error:', err.message);
    }
  }, CONFIG.CHECK_INTERVAL);
}

console.log('🚀 Starting Instant Buy Bot...');
main();

process.on('uncaughtException', (err) => {
  console.error('❌ Fatal error:', err);
  saveData();
});

module.exports = { trades, activePositions, stats };
