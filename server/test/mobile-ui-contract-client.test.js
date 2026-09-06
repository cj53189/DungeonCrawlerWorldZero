const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const uiEditor = fs.readFileSync(path.resolve(__dirname, '../../src/ui-editor-v2.js'), 'utf8');
const portraitInventory = fs.readFileSync(path.resolve(__dirname, '../../src/mobile-inventory-portrait-fix.js'), 'utf8');

test('UI editor touch controls use at least 48px interaction targets', () => {
  assert.match(uiEditor, /\.uiEditTools button,\.uiEditResize\{width:48px;height:48px/);

  for (const key of ['settings', 'lobbyButton', 'interact', 'dodge', 'invButton', 'weaponButton', 'logButton', 'recapButton', 'touchSettings', 'lightButton']) {
    const match = uiEditor.match(new RegExp(`\\['${key}'[^\\]]+,(\\d+),(\\d+)(?:,true)?\\]`));
    assert.ok(match, `expected UI editor target metadata for ${key}`);
    assert.ok(Number(match[1]) >= 48, `${key} minimum width should be at least 48px`);
    assert.ok(Number(match[2]) >= 48, `${key} minimum height should be at least 48px`);
  }
});

test('portrait inventory and skills overrides preserve readable text and touch targets', () => {
  assert.match(portraitInventory, /#inventoryHelp[\s\S]*?font-size: 12px !important;/);
  assert.match(portraitInventory, /\.attributeRow small,[\s\S]*?font-size: 12px !important;/);
  assert.match(portraitInventory, /\.spendPointBtn \{[\s\S]*?min-width: 48px !important;[\s\S]*?min-height: 48px !important;[\s\S]*?font-size: 12px !important;/);
});
