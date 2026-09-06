const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../../src/multiplayer-session-auth.js'), 'utf8');

function installContext(networkOverrides = {}) {
  const sent = [];
  const handled = [];
  const context = {
    multiplayerNetwork: {
      playerId: null,
      resumeCredential: null,
      ...networkOverrides
    },
    sendMultiplayerMessage(type, payload = {}) {
      sent.push({ type, payload });
      return true;
    },
    handleMultiplayerServerMessage(message) {
      handled.push(message);
    }
  };
  vm.runInNewContext(source, context, { filename: 'multiplayer-session-auth.js' });
  return { context, sent, handled };
}

test('hello messages include the private resume credential when available', () => {
  const { context, sent } = installContext({
    playerId: 'player_a',
    resumeCredential: 'secret_resume_token'
  });

  context.sendMultiplayerMessage('hello', { playerId: 'player_a' });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].payload.playerId, 'player_a');
  assert.equal(sent[0].payload.resumeCredential, 'secret_resume_token');

  context.sendMultiplayerMessage('quick_match', { arena: false });
  assert.equal(sent[1].payload.resumeCredential, undefined);
});

test('provisional welcome does not replace an established reconnect identity', () => {
  const { context, handled } = installContext({
    playerId: 'player_a',
    resumeCredential: 'secret_resume_token'
  });

  context.handleMultiplayerServerMessage({
    type: 'welcome',
    provisional: true,
    playerId: 'temporary_player'
  });

  assert.equal(handled.length, 0);
  assert.equal(context.multiplayerNetwork.playerId, 'player_a');
  assert.equal(context.multiplayerNetwork.resumeCredential, 'secret_resume_token');
});

test('final welcome rotates the stored resume credential and reaches the normal handler', () => {
  const { context, handled } = installContext({
    playerId: 'player_a',
    resumeCredential: 'old_secret'
  });

  context.handleMultiplayerServerMessage({
    type: 'welcome',
    playerId: 'player_a',
    resumeCredential: 'new_secret'
  });

  assert.equal(context.multiplayerNetwork.resumeCredential, 'new_secret');
  assert.equal(handled.length, 1);
  assert.equal(handled[0].playerId, 'player_a');
});
