// start.js - شروع همزمان Bot و Server

const { spawn } = require('child_process');
const path = require('path');

console.log('\n' + '═'.repeat(80));
console.log('🚀 SOLANA TRADING BOT SYSTEM STARTER v4.0');
console.log('═'.repeat(80) + '\n');

// Start Bot
console.log('🤖 Starting Trading Bot...');
const bot = spawn('node', ['bot.js'], {
  stdio: 'inherit',
  shell: true,
  cwd: __dirname
});

bot.on('error', (err) => {
  console.error('❌ Bot error:', err);
});

bot.on('exit', (code) => {
  console.log(`⚠️  Bot exited with code ${code}`);
  if (code !== 0) {
    console.log('🔄 Restarting bot in 5 seconds...');
    setTimeout(() => {
      spawn('node', ['bot.js'], {
        stdio: 'inherit',
        shell: true,
        cwd: __dirname
      });
    }, 5000);
  }
});

// Wait a bit before starting server
setTimeout(() => {
  console.log('🌐 Starting API Server...');
  const server = spawn('node', ['server.js'], {
    stdio: 'inherit',
    shell: true,
    cwd: __dirname
  });

  server.on('error', (err) => {
    console.error('❌ Server error:', err);
  });

  server.on('exit', (code) => {
    console.log(`⚠️  Server exited with code ${code}`);
    if (code !== 0) {
      console.log('🔄 Restarting server in 5 seconds...');
      setTimeout(() => {
        spawn('node', ['server.js'], {
          stdio: 'inherit',
          shell: true,
          cwd: __dirname
        });
      }, 5000);
    }
  });

  // Graceful shutdown for server
  process.on('SIGTERM', () => {
    console.log('\n⚠️  SIGTERM received - shutting down server...');
    server.kill('SIGTERM');
  });

  process.on('SIGINT', () => {
    console.log('\n⚠️  SIGINT received - shutting down server...');
    server.kill('SIGINT');
  });

}, 2000);

// Graceful shutdown for bot
process.on('SIGTERM', () => {
  console.log('\n⚠️  SIGTERM received - shutting down bot...');
  bot.kill('SIGTERM');
  setTimeout(() => process.exit(0), 1000);
});

process.on('SIGINT', () => {
  console.log('\n⚠️  SIGINT received - shutting down bot...');
  bot.kill('SIGINT');
  setTimeout(() => process.exit(0), 1000);
});

console.log('✅ System initialization complete!\n');
console.log('📊 Bot: Starting...');
console.log('🌐 Server: Starting...\n');
console.log('═'.repeat(80) + '\n');
