#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the logo file
const logoPath = path.join(__dirname, 'shared/terminal/logo.ts');
let content = fs.readFileSync(logoPath, 'utf8');

console.log('Original content preview:');
console.log(content.substring(0, 200) + '...');

// Fix line endings in the logo data
// Replace \x1b[m\n with \x1b[m\r\n for proper terminal rendering
content = content.replace(/\\x1b\[m\n/g, '\\x1b[m\\r\n');

// Also fix any standalone \n that should be \r\n in the logo
// But be careful not to affect the JavaScript template literal structure
const logoStartIndex = content.indexOf('const cliLogoData = `');
const logoEndIndex = content.indexOf('`;', logoStartIndex);

if (logoStartIndex !== -1 && logoEndIndex !== -1) {
    const beforeLogo = content.substring(0, logoStartIndex);
    const logoContent = content.substring(logoStartIndex, logoEndIndex + 2);
    const afterLogo = content.substring(logoEndIndex + 2);
    
    // Fix line endings within the logo content only
    const fixedLogoContent = logoContent.replace(/\\x1b\[m\n/g, '\\x1b[m\\r\n');
    
    content = beforeLogo + fixedLogoContent + afterLogo;
}

console.log('\nFixed content preview:');
console.log(content.substring(0, 200) + '...');

// Write back the fixed content
fs.writeFileSync(logoPath, content, 'utf8');

console.log('\n✅ Fixed line endings in logo file!');
console.log('All \\x1b[m\\n sequences have been replaced with \\x1b[m\\r\\n');
