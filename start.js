// start.js - شروع همزمان Bot و Server

const { spawn } = require('child_process');

console.log('🚀 Starting Solana Trading Bot System...\n');

// Start Bot
const bot = spawn('node', ['bot.js'], {
  stdio: 'inherit',
  shell: true
});

bot.on('error', (err) => {
  console.error('❌ Bot error:', err);
});

bot.on('exit', (code) => {
  console.log(`⚠️ Bot exited with code ${code}`);
});

// Start Server
const server = spawn('node', ['server.js'], {
  stdio: 'inherit',
  shell: true
});

server.on('error', (err) => {
  console.error('❌ Server error:', err);
});

server.on('exit', (code) => {
  console.log(`⚠️ Server exited with code ${code}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n⚠️ Shutting down...');
  bot.kill();
  server.kill();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n⚠️ Shutting down...');
  bot.kill();
  server.kill();
  process.exit(0);
});

console.log('✅ System started successfully!\n');
console.log('🤖 Bot: Running');
console.log('🌐 Server: Running\n');
