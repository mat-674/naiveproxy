const fs = require('fs');

console.log('NaiveProxy Mock Started (simulated)');
const configFile = process.argv[2];

if (configFile) {
    console.log(`Loading config from: ${configFile}`);
    try {
        const content = fs.readFileSync(configFile, 'utf8');
        console.log('Config content:', content);
    } catch (e) {
        console.error('Failed to read config:', e);
    }
}

console.log('naive[123]: listening on socks://127.0.0.1:1080');

// Simulate some traffic logs
const interval = setInterval(() => {
    const id = Math.floor(Math.random() * 1000);
    console.log(`naive[${id}]: connect example.com:443`);
}, 3000);

process.stdin.resume();

process.on('SIGTERM', () => {
    console.log('Received SIGTERM, exiting...');
    clearInterval(interval);
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('Received SIGINT, exiting...');
    clearInterval(interval);
    process.exit(0);
});
