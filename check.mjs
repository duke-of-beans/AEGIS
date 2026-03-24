import { existsSync } from 'fs';
import { join } from 'path';
const p = join(process.env.APPDATA, 'AEGIS', 'aegis-config.yaml');
console.log('APPDATA:', process.env.APPDATA);
console.log('Checking:', p);
console.log('Exists:', existsSync(p));
// also check forward slash variant
const p2 = 'C:/Users/DKdKe/AppData/Roaming/AEGIS/aegis-config.yaml';
console.log('Exists (fwd slash):', existsSync(p2));
