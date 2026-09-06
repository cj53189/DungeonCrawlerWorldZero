(() => {
  if (typeof multiplayerNetwork !== "object" || multiplayerNetwork.sessionAuthInstalled) return;
  if (typeof sendMultiplayerMessage !== "function" || typeof handleMultiplayerServerMessage !== "function") return;

  multiplayerNetwork.sessionAuthInstalled = true;
  multiplayerNetwork.resumeCredential = multiplayerNetwork.resumeCredential || null;

  const originalSendMultiplayerMessage = sendMultiplayerMessage;
  sendMultiplayerMessage = function sessionAuthenticatedSend(type, payload = {}) {
    if (type === "hello" && multiplayerNetwork.resumeCredential) {
      return originalSendMultiplayerMessage(type, {
        ...payload,
        resumeCredential: multiplayerNetwork.resumeCredential
      });
    }
    return originalSendMultiplayerMessage(type, payload);
  };

  const originalHandleMultiplayerServerMessage = handleMultiplayerServerMessage;
  handleMultiplayerServerMessage = function sessionAuthenticatedReceive(message) {
    if (message?.type === "welcome") {
      const credential = typeof message.resumeCredential === "string" ? message.resumeCredential.trim() : "";
      const isReconnectProbe = !!(
        message.provisional &&
        multiplayerNetwork.resumeCredential &&
        multiplayerNetwork.playerId
      );

      if (isReconnectProbe) return;
      if (credential) multiplayerNetwork.resumeCredential = credential;
    }

    return originalHandleMultiplayerServerMessage(message);
  };
})();
