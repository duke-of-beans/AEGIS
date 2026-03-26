const m = require('systray2');
console.log('type:', typeof m);
console.log('keys:', Object.keys(m));
console.log('default:', typeof m.default);
console.log('isClass:', typeof m === 'function');
