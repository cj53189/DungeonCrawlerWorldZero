const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../../src/voice-chat.js'), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `expected ${name} in voice-chat.js`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index++) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`could not extract ${name}`);
}

const lifecycleSource = [
  extractFunction('requestVoiceMicrophone'),
  extractFunction('stopVoiceChat')
].join('\n');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function makeContext(getUserMedia) {
  const context = {
    voiceChat: {
      enabled: true,
      mode: 'push_to_talk',
      localStream: null,
      peers: new Map(),
      remoteAudio: new Map(),
      pendingConnections: new Set(),
      selfMuted: false,
      lastError: null,
      sessionGeneration: 0
    },
    navigator: { mediaDevices: { getUserMedia } },
    initVoiceChat() {},
    updateLocalVoiceTrackState() {},
    addLocalVoiceTracks() {},
    setVoicePushToTalkActive() {},
    cleanupVoicePeer() {},
    stopVoiceProximityTimer() {},
    stopVoiceLifecycleTimer() {},
    updateVoiceProximityVolumes() {},
    updateVoiceChatUi() {},
    announcer() {}
  };
  vm.runInNewContext(lifecycleSource, context, { filename: 'voice-chat-lifecycle.js' });
  return context;
}

test('a microphone stream resolving after voice teardown is stopped and discarded', async () => {
  const media = deferred();
  const context = makeContext(() => media.promise);
  const track = {
    enabled: true,
    stopCount: 0,
    stop() { this.stopCount += 1; }
  };
  const stream = {
    getTracks() { return [track]; },
    getAudioTracks() { return [track]; }
  };

  const pending = context.requestVoiceMicrophone();
  context.stopVoiceChat('left_lobby');
  media.resolve(stream);

  const result = await pending;
  assert.equal(result, null);
  assert.equal(context.voiceChat.localStream, null);
  assert.equal(context.voiceChat.sessionGeneration, 1);
  assert.equal(track.enabled, false);
  assert.equal(track.stopCount, 1);
});

test('a microphone stream for the current voice session is retained', async () => {
  const track = { enabled: true, stopCount: 0, stop() { this.stopCount += 1; } };
  const stream = {
    getTracks() { return [track]; },
    getAudioTracks() { return [track]; }
  };
  const context = makeContext(async () => stream);

  const result = await context.requestVoiceMicrophone();

  assert.equal(result, stream);
  assert.equal(context.voiceChat.localStream, stream);
  assert.equal(track.stopCount, 0);
  assert.equal(context.voiceChat.lastError, null);
});
