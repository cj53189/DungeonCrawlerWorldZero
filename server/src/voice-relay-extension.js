const { CLIENT_MESSAGES, safeSend } = require("./protocol");

const VOICE_SIGNAL_TYPES = new Set([
  CLIENT_MESSAGES.VOICE_OFFER,
  CLIENT_MESSAGES.VOICE_ANSWER,
  CLIENT_MESSAGES.VOICE_ICE_CANDIDATE,
  CLIENT_MESSAGES.VOICE_DISCONNECT
]);

function applyVoiceRelayExtension(LobbyManager) {
  const proto = LobbyManager.prototype;
  if (proto.relayVoiceSignal?.__voiceRelayExtension) return;

  proto.relayVoiceSignal = function relayVoiceSignal(fromPlayerId, message = {}) {
    if (!message || !VOICE_SIGNAL_TYPES.has(message.type)) return false;

    const sender = this.clients.get(fromPlayerId);
    const targetPlayerId = String(message.targetPlayerId || "");
    if (!sender?.lobbyCode || !targetPlayerId || targetPlayerId === fromPlayerId) return false;

    const target = this.clients.get(targetPlayerId);
    if (!target || target.lobbyCode !== sender.lobbyCode) return false;

    const lobby = this.lobbies.get(sender.lobbyCode);
    const senderInLobby = lobby?.players?.some(player => player.id === fromPlayerId);
    const targetInLobby = lobby?.players?.some(player => player.id === targetPlayerId);
    if (!senderInLobby || !targetInLobby) return false;

    return safeSend(target.ws, message.type, {
      fromPlayerId,
      targetPlayerId,
      offer: message.offer,
      answer: message.answer,
      candidate: message.candidate,
      reason: message.reason
    });
  };
  proto.relayVoiceSignal.__voiceRelayExtension = true;
}

module.exports = { applyVoiceRelayExtension };
