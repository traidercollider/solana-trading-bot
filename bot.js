// SOLANA MEMECOIN TRADING BOT - PRODUCTION v4.0
// Optimized for Memecoins on Solana Blockchain
// Mode: Simulation (Virtual Trading)

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// =============================================
// CONFIGURATION
// =============================================

const CONFIG = {
  // Trading Settings
  POSITION_SIZE: 10,              // $10 per trade
  TAKE_PROFIT: 0.50,              // 50% profit target
  STOP_LOSS: -0.25,               // -25% stop loss
  
  // Token Discovery (Optimized for Memecoins)
  MAX_TOKEN_AGE: 2,               // Max 2 seconds old
  MIN_LIQUIDITY: 50,              // Min $50 liquidity (low for memecoins)
  CHECK_INTERVAL: 500,            // Check every 0.5 seconds
  
  // Safety Checks
  ENABLE_SAFETY_CHECK: true,      // Check if token is safe
  MIN_HOLDERS: 3,                 // Min 3 holders
  
  // Fees (Solana)
  TRANSACTION_FEE: 0.000005,      // ~0.000005 SOL per transaction
  SWAP_FEE_PERCENT: 0.003,        // 0.3% swap fee
  
  // Simulation
  SIMULATION_MODE: true,
  SIMULATE_VOLATILITY: true,
  MIN_PRICE_CHANGE: -35,
  MAX_PRICE_CHANGE: 200,
  
  // Intervals
  SAVE_INTERVAL: 2000,
  REPORT_INTERVAL: 30000,
  PRICE_UPDATE_INTERVAL: 800,
  STATS_UPDATE_INTERVAL: 1000,
};

// =============================================
// GLOBAL STATE
// =============================================

let state = {
  trades: [],
  activePositions: [],
  recentScans: [],
  stats: {
    totalTrades: 0,
    wins: 0,
    losses: 0,
    totalProfit: 0,
    totalFees: 0,
    netProfit: 0,
    capital: 1000,
    initialCapital: 1000,
    startTime: Date.now(),
    scannedTokens: 0,
    rejectedTokens: 0,
    lastSaveTime: Date.now(),
    lastReportTime: Date.now(),
    avgTradeTime: 0,
    bestTrade: null,
    worstTrade: null,
  },
  performance: {
    hourlyStats: [],
    last24h: { trades: 0, profit: 0, wins: 0 },
  },
  scanCount: 0,
  shouldSave: false,
};

// =============================================
// SOLANA TOKEN DISCOVERY
// =============================================

async function discoverNewTokens() {
  try {
    state.scanCount++;
    
    if (CONFIG.SIMULATION_MODE) {
      return simulateNewTokens();
    }
    
    // Production: Real Solana API calls
    const tokens = [];
    
    // Raydium DEX - Main source for new tokens
    try {
      const raydiumTokens = await fetchRaydiumTokens();
      tokens.push(...raydiumTokens);
    } catch (err) {
      console.error('⚠️  Raydium API error:', err.message);
    }
    
    // DexScreener - Secondary source
    try {
      const dexTokens = await fetchDexScreenerTokens();
      tokens.push(...dexTokens);
    } catch (err) {
      console.error('⚠️  DexScreener API error:', err.message);
    }
    
    return filterNewTokens(tokens);
    
  } catch (err) {
    console.error('❌ Token discovery error:', err.message);
    return [];
  }
}

function simulateNewTokens() {
  const shouldFind = Math.random() > 0.65; // 35% chance
  if (!shouldFind) return [];
  
  const numTokens = Math.floor(Math.random() * 2) + 1; // 1-2 tokens
  const tokens = [];
  
  for (let i = 0; i < numTokens; i++) {
    const tokenId = Math.floor(Math.random() * 999999);
    const createdAt = Date.now() - (Math.random() * 1500); // 0-1.5 seconds ago
    
    const token = {
      address: `${generateSolanaAddress()}`,
      symbol: generateMemecoinSymbol(),
      name: generateMemecoinName(),
      pairAddress: `pair_${generateSolanaAddress()}`,
      price: Math.random() * 0.0001,
      liquidity: 50 + (Math.random() * 2000),
      holders: Math.floor(Math.random() * 50) + 3,
      age: (Date.now() - createdAt) / 1000,
      createdAt: createdAt,
      volume24h: Math.random() * 10000,
      priceChange24h: (Math.random() - 0.5) * 100,
      isSafe: Math.random() > 0.1, // 90% safe
      canSell: Math.random() > 0.05, // 95% sellable
      image: generateTokenImage(),
    };
    
    tokens.push(token);
  }
  
  state.stats.scannedTokens += tokens.length;
  
  // Add to recent scans
  state.recentScans.unshift({
    timestamp: Date.now(),
    found: tokens.length,
    symbols: tokens.map(t => t.symbol),
  });
  
  if (state.recentScans.length > 100) {
    state.recentScans = state.recentScans.slice(0, 100);
  }
  
  return tokens;
}

function generateSolanaAddress() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789';
  let addr = '';
  for (let i = 0; i < 44; i++) {
    addr += chars[Math.floor(Math.random() * chars.length)];
  }
  return addr;
}

function generateMemecoinSymbol() {
  const prefixes = ['PEPE', 'DOGE', 'SHIB', 'FLOKI', 'BONK', 'WIF', 'MEME', 'APE', 'WOJAK', 'CHAD'];
  const suffixes = ['', 'INU', 'COIN', 'AI', '2.0', 'X', 'PRO', 'MOON'];
  return prefixes[Math.floor(Math.random() * prefixes.length)] + 
         suffixes[Math.floor(Math.random() * suffixes.length)];
}

function generateMemecoinName() {
  const names = [
    'Moon Dog', 'Pepe Inu', 'Shiba King', 'Floki Warrior',
    'Bonk Master', 'Doge Moon', 'Wojak Coin', 'Chad Token',
    'Ape Strong', 'Rocket Shib', 'Diamond Pepe', 'Lambo Doge'
  ];
  return names[Math.floor(Math.random() * names.length)];
}

function generateTokenImage() {
  const images = [
    'https://cdn-icons-png.flaticon.com/512/2504/2504929.png',
    'https://cdn-icons-png.flaticon.com/512/2504/2504930.png',
    'https://cdn-icons-png.flaticon.com/512/2504/2504918.png',
    'https://cdn-icons-png.flaticon.com/512/2504/2504739.png',
  ];
  return images[Math.floor(Math.random() * images.length)];
}

// =============================================
// TOKEN FILTERING & SAFETY CHECKS
// =============================================

function filterNewTokens(tokens) {
  return tokens.filter(token => {
    // Check age
    if (token.age > CONFIG.MAX_TOKEN_AGE) {
      state.stats.rejectedTokens++;
      return false;
    }
    
    // Check liquidity
    if (token.liquidity < CONFIG.MIN_LIQUIDITY) {
      state.stats.rejectedTokens++;
      return false;
    }
    
    // Check if already bought
    if (state.activePositions.some(p => p.address === token.address)) {
      return false;
    }
    
    // Safety checks
    if (CONFIG.ENABLE_SAFETY_CHECK) {
      if (!token.isSafe || !token.canSell) {
        state.stats.rejectedTokens++;
        return false;
      }
      
      if (token.holders < CONFIG.MIN_HOLDERS) {
        state.stats.rejectedTokens++;
        return false;
      }
    }
    
    return true;
  });
}

// =============================================
// TRADING LOGIC
// =============================================

async function buyToken(token) {
  try {
    // Calculate fees
    const swapFee = CONFIG.POSITION_SIZE * CONFIG.SWAP_FEE_PERCENT;
    const totalCost = CONFIG.POSITION_SIZE + swapFee;
    
    if (state.stats.capital < totalCost) {
      console.log(`⚠️  Insufficient capital: $${state.stats.capital.toFixed(2)}`);
      return null;
    }
    
    const position = {
      id: `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      address: token.address,
      pairAddress: token.pairAddress,
      symbol: token.symbol,
      name: token.name,
      image: token.image,
      buyPrice: token.price,
      currentPrice: token.price,
      quantity: CONFIG.POSITION_SIZE / token.price,
      investedAmount: CONFIG.POSITION_SIZE,
      fees: swapFee,
      buyTime: Date.now(),
      liquidity: token.liquidity,
      holders: token.holders,
      checkCount: 0,
      maxProfit: 0,
      minProfit: 0,
      maxPrice: token.price,
      minPrice: token.price,
    };
    
    state.activePositions.push(position);
    state.stats.capital -= totalCost;
    state.stats.totalFees += swapFee;
    
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`🟢 BUY SIGNAL - NEW MEMECOIN DETECTED`);
    console.log(`${'═'.repeat(80)}`);
    console.log(`   Token: ${position.symbol} (${position.name})`);
    console.log(`   Address: ${position.address.substring(0, 20)}...`);
    console.log(`   💰 Price: $${position.buyPrice.toFixed(10)}`);
    console.log(`   📊 Amount: $${CONFIG.POSITION_SIZE} + $${swapFee.toFixed(3)} fee`);
    console.log(`   💧 Liquidity: $${token.liquidity.toFixed(0)}`);
    console.log(`   👥 Holders: ${token.holders}`);
    console.log(`   💵 Remaining Capital: $${state.stats.capital.toFixed(2)}`);
    console.log(`   📦 Active Positions: ${state.activePositions.length}`);
    console.log(`${'═'.repeat(80)}\n`);
    
    state.shouldSave = true;
    return position;
    
  } catch (err) {
    console.error('❌ Buy error:', err.message);
    return null;
  }
}

async function updatePositionPrices() {
  if (state.activePositions.length === 0) return;
  
  for (const pos of state.activePositions) {
    pos.checkCount++;
    
    // Simulate price volatility
    if (CONFIG.SIMULATE_VOLATILITY) {
      const priceChange = 
        CONFIG.MIN_PRICE_CHANGE + 
        (Math.random() * (CONFIG.MAX_PRICE_CHANGE - CONFIG.MIN_PRICE_CHANGE));
      
      pos.currentPrice = pos.buyPrice * (1 + priceChange / 100);
    }
    
    // Track price extremes
    if (pos.currentPrice > pos.maxPrice) pos.maxPrice = pos.currentPrice;
    if (pos.currentPrice < pos.minPrice) pos.minPrice = pos.currentPrice;
    
    // Calculate profit
    const currentValue = pos.quantity * pos.currentPrice;
    const profit = currentValue - pos.investedAmount - pos.fees;
    const profitPercent = (profit / (pos.investedAmount + pos.fees)) * 100;
    
    pos.profit = profit;
    pos.profitPercent = profitPercent;
    
    if (profitPercent > pos.maxProfit) pos.maxProfit = profitPercent;
    if (profitPercent < pos.minProfit) pos.minProfit = profitPercent;
  }
}

async function checkSellSignals() {
  if (state.activePositions.length === 0) return;
  
  for (let i = state.activePositions.length - 1; i >= 0; i--) {
    const pos = state.activePositions[i];
    
    let shouldSell = false;
    let sellReason = '';
    
    // Take profit
    if (pos.profitPercent >= CONFIG.TAKE_PROFIT * 100) {
      shouldSell = true;
      sellReason = `🎯 TAKE PROFIT: ${pos.profitPercent.toFixed(2)}%`;
    }
    // Stop loss
    else if (pos.profitPercent <= CONFIG.STOP_LOSS * 100) {
      shouldSell = true;
      sellReason = `🛑 STOP LOSS: ${pos.profitPercent.toFixed(2)}%`;
    }
    
    if (shouldSell) {
      await sellPosition(pos, sellReason, i);
    }
  }
}

async function sellPosition(position, reason, index) {
  try {
    const sellFee = (position.quantity * position.currentPrice) * CONFIG.SWAP_FEE_PERCENT;
    const grossProfit = (position.quantity * position.currentPrice) - position.investedAmount;
    const netProfit = grossProfit - position.fees - sellFee;
    const duration = (Date.now() - position.buyTime) / 1000;
    
    const trade = {
      id: position.id,
      address: position.address,
      symbol: position.symbol,
      name: position.name,
      image: position.image,
      buyPrice: position.buyPrice,
      sellPrice: position.currentPrice,
      quantity: position.quantity,
      investedAmount: position.investedAmount,
      buyTime: position.buyTime,
      sellTime: Date.now(),
      duration: duration,
      grossProfit: grossProfit,
      netProfit: netProfit,
      profitPercent: (netProfit / position.investedAmount) * 100,
      fees: position.fees + sellFee,
      status: netProfit > 0 ? 'win' : 'loss',
      reason: reason,
      checkCount: position.checkCount,
      maxProfit: position.maxProfit,
      minProfit: position.minProfit,
      maxPrice: position.maxPrice,
      minPrice: position.minPrice,
    };
    
    // Update stats
    state.trades.push(trade);
    state.stats.totalTrades++;
    state.stats.totalFees += sellFee;
    state.stats.totalProfit += grossProfit;
    state.stats.netProfit += netProfit;
    state.stats.capital += (position.quantity * position.currentPrice) - sellFee;
    
    if (netProfit > 0) {
      state.stats.wins++;
    } else {
      state.stats.losses++;
    }
    
    // Track best/worst trades
    if (!state.stats.bestTrade || netProfit > state.stats.bestTrade.netProfit) {
      state.stats.bestTrade = trade;
    }
    if (!state.stats.worstTrade || netProfit < state.stats.worstTrade.netProfit) {
      state.stats.worstTrade = trade;
    }
    
    // Calculate average trade time
    const totalTime = state.trades.reduce((sum, t) => sum + t.duration, 0);
    state.stats.avgTradeTime = totalTime / state.trades.length;
    
    // Log trade
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`${netProfit > 0 ? '✅ PROFITABLE TRADE' : '❌ LOSS TRADE'}: ${position.symbol}`);
    console.log(`${'═'.repeat(80)}`);
    console.log(`   ${reason}`);
    console.log(`   💰 Buy: $${position.buyPrice.toFixed(10)} → Sell: $${position.currentPrice.toFixed(10)}`);
    console.log(`   📊 Gross P/L: $${grossProfit.toFixed(2)} (${trade.profitPercent.toFixed(2)}%)`);
    console.log(`   💸 Fees: $${trade.fees.toFixed(3)}`);
    console.log(`   💵 Net P/L: $${netProfit.toFixed(2)}`);
    console.log(`   ⏱️  Duration: ${duration.toFixed(1)}s | Checks: ${position.checkCount}`);
    console.log(`   📈 Max: +${position.maxProfit.toFixed(1)}% ($${position.maxPrice.toFixed(10)})`);
    console.log(`   📉 Min: ${position.minProfit.toFixed(1)}% ($${position.minPrice.toFixed(10)})`);
    console.log(`   💰 New Capital: $${state.stats.capital.toFixed(2)}`);
    console.log(`${'═'.repeat(80)}\n`);
    
    // Remove position
    state.activePositions.splice(index, 1);
    state.shouldSave = true;
    
  } catch (err) {
    console.error('❌ Sell error:', err.message);
  }
}

// =============================================
// DATA PERSISTENCE
// =============================================

function saveData() {
  try {
    const data = {
      trades: state.trades.slice(-500),
      activePositions: state.activePositions.map(p => ({
        ...p,
        age: ((Date.now() - p.buyTime) / 1000).toFixed(1),
      })),
      stats: {
        ...state.stats,
        roi: (((state.stats.capital - state.stats.initialCapital) / state.stats.initialCapital) * 100).toFixed(2),
        winRate: state.stats.totalTrades > 0 
          ? ((state.stats.wins / state.stats.totalTrades) * 100).toFixed(1)
          : 0,
        avgProfitPerTrade: state.stats.totalTrades > 0
          ? (state.stats.netProfit / state.stats.totalTrades).toFixed(2)
          : 0,
        uptime: ((Date.now() - state.stats.startTime) / 1000).toFixed(0),
      },
      recentScans: state.recentScans.slice(0, 20),
      performance: calculatePerformance(),
      lastUpdate: new Date().toISOString(),
      version: '4.0.0',
    };
    
    const dataPath = path.join(__dirname, 'trading_data.json');
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    
    state.stats.lastSaveTime = Date.now();
    state.shouldSave = false;
    
    return true;
  } catch (err) {
    console.error('❌ Save error:', err.message);
    return false;
  }
}

function loadData() {
  try {
    const dataPath = path.join(__dirname, 'trading_data.json');
    
    if (fs.existsSync(dataPath)) {
      const rawData = fs.readFileSync(dataPath, 'utf8');
      const data = JSON.parse(rawData);
      
      state.trades = data.trades || [];
      state.activePositions = data.activePositions || [];
      state.stats = { ...state.stats, ...(data.stats || {}) };
      state.recentScans = data.recentScans || [];
      
      console.log(`✅ Data loaded: ${state.trades.length} trades, ${state.activePositions.length} positions`);
      console.log(`💰 Capital: $${state.stats.capital.toFixed(2)}`);
      return true;
    }
    
    console.log('⚠️  No previous data - starting fresh');
    return false;
  } catch (err) {
    console.error('❌ Load error:', err.message);
    return false;
  }
}

function calculatePerformance() {
  const now = Date.now();
  const oneDayAgo = now - (24 * 60 * 60 * 1000);
  
  const last24hTrades = state.trades.filter(t => t.sellTime >= oneDayAgo);
  
  return {
    last24h: {
      trades: last24hTrades.length,
      profit: last24hTrades.reduce((sum, t) => sum + t.netProfit, 0),
      wins: last24hTrades.filter(t => t.status === 'win').length,
      losses: last24hTrades.filter(t => t.status === 'loss').length,
    },
    hourly: generateHourlyStats(),
  };
}

function generateHourlyStats() {
  const hourly = [];
  const now = Date.now();
  
  for (let i = 23; i >= 0; i--) {
    const hourStart = now - (i * 60 * 60 * 1000);
    const hourEnd = hourStart + (60 * 60 * 1000);
    
    const hourTrades = state.trades.filter(t => 
      t.sellTime >= hourStart && t.sellTime < hourEnd
    );
    
    hourly.push({
      hour: new Date(hourStart).toISOString(),
      trades: hourTrades.length,
      profit: hourTrades.reduce((sum, t) => sum + t.netProfit, 0),
      wins: hourTrades.filter(t => t.status === 'win').length,
    });
  }
  
  return hourly;
}

// =============================================
// REPORTING
// =============================================

function printReport() {
  const uptime = (Date.now() - state.stats.startTime) / 1000;
  const uptimeHours = (uptime / 3600).toFixed(1);
  const winRate = state.stats.totalTrades > 0 
    ? ((state.stats.wins / state.stats.totalTrades) * 100).toFixed(1)
    : 0;
  const roi = ((state.stats.capital - state.stats.initialCapital) / state.stats.initialCapital * 100).toFixed(2);
  
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`📊 PERFORMANCE REPORT - ${new Date().toLocaleString('en-US')}`);
  console.log(`${'═'.repeat(80)}`);
  console.log(`💰 Capital: $${state.stats.capital.toFixed(2)} | Initial: $${state.stats.initialCapital}`);
  console.log(`📈 ROI: ${roi}% | Net Profit: $${state.stats.netProfit.toFixed(2)}`);
  console.log(`💸 Total Fees Paid: $${state.stats.totalFees.toFixed(2)}`);
  console.log(`📊 Trades: ${state.stats.totalTrades} | Wins: ${state.stats.wins} | Losses: ${state.stats.losses}`);
  console.log(`🎯 Win Rate: ${winRate}% | Avg P/L: $${(state.stats.netProfit / (state.stats.totalTrades || 1)).toFixed(2)}`);
  console.log(`⏱️  Avg Trade Time: ${state.stats.avgTradeTime.toFixed(1)}s`);
  console.log(`🔍 Scanned: ${state.stats.scannedTokens} | Rejected: ${state.stats.rejectedTokens}`);
  console.log(`📦 Active Positions: ${state.activePositions.length}`);
  console.log(`⏰ Uptime: ${uptimeHours}h | Scans: ${state.scanCount}`);
  
  if (state.stats.bestTrade) {
    console.log(`🏆 Best Trade: ${state.stats.bestTrade.symbol} (+$${state.stats.bestTrade.netProfit.toFixed(2)})`);
  }
  
  console.log(`${'═'.repeat(80)}\n`);
  
  state.stats.lastReportTime = Date.now();
}

// =============================================
// MAIN LOOP
// =============================================

async function mainLoop() {
  try {
    // Discover new tokens
    const tokens = await discoverNewTokens();
    
    if (tokens.length > 0) {
      console.log(`\n🔍 Found ${tokens.length} new memecoin(s)`);
      
      for (const token of tokens) {
        await buyToken(token);
      }
    }
    
    // Update prices
    await updatePositionPrices();
    
    // Check sell signals
    await checkSellSignals();
    
    // Save data periodically
    const timeSinceLastSave = Date.now() - state.stats.lastSaveTime;
    if (state.shouldSave && timeSinceLastSave >= CONFIG.SAVE_INTERVAL) {
      saveData();
    }
    
    // Print report periodically
    const timeSinceLastReport = Date.now() - state.stats.lastReportTime;
    if (timeSinceLastReport >= CONFIG.REPORT_INTERVAL) {
      printReport();
    }
    
  } catch (err) {
    console.error('❌ Main loop error:', err.message);
  }
}

// =============================================
// INITIALIZATION
// =============================================

async function initialize() {
  console.log('\n' + '═'.repeat(80));
  console.log('🚀 SOLANA MEMECOIN TRADING BOT v4.0');
  console.log('═'.repeat(80));
  console.log(`💰 Initial Capital: $${state.stats.initialCapital}`);
  console.log(`🎯 Take Profit: ${CONFIG.TAKE_PROFIT * 100}% | Stop Loss: ${CONFIG.STOP_LOSS * 100}%`);
  console.log(`📦 Position Size: $${CONFIG.POSITION_SIZE} per trade`);
  console.log(`⏱️  Check Interval: ${CONFIG.CHECK_INTERVAL}ms`);
  console.log(`💧 Min Liquidity: $${CONFIG.MIN_LIQUIDITY} (Optimized for memecoins)`);
  console.log(`⏰ Max Token Age: ${CONFIG.MAX_TOKEN_AGE} seconds`);
  console.log(`🔧 Mode: ${CONFIG.SIMULATION_MODE ? 'SIMULATION' : 'LIVE TRADING'}`);
  console.log('═'.repeat(80) + '\n');
  
  // Load previous data
  loadData();
  
  // Start loops
  console.log('✅ Bot started successfully!\n');
  
  setInterval(mainLoop, CONFIG.CHECK_INTERVAL);
  setInterval(() => state.shouldSave = true, CONFIG.SAVE_INTERVAL);
  
  // Initial save
  setTimeout(() => {
    saveData();
    printReport();
  }, 3000);
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
