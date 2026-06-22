(() => {
  // prevent multiple initialization
  if (window.QUEST_SYSTEM_INITIALIZED) return;
  window.QUEST_SYSTEM_INITIALIZED = true;

  const quests = [];
  const QUEST_DEFINITIONS = [
    {
      id: 'kill-10-rats',
      name: 'Rat Slayer',
      description: 'Eliminate 10 rats',
      type: 'kill',
      target: 'rat',
      required: 10,
      reward: { coins: 50 }
    }
  ];

  const questHud = document.createElement('div');
  questHud.id = 'questHud';
  questHud.style.position = 'absolute';
  questHud.style.left = '1rem';
  questHud.style.top = '8rem';
  questHud.style.zIndex = '12';
  questHud.style.color = '#fff';
  questHud.style.background = 'rgba(0,0,0,0.5)';
  questHud.style.padding = '0.5rem';
  questHud.style.fontSize = '12px';
  questHud.style.borderRadius = '4px';

  function updateHud() {
    questHud.innerHTML = '';
    quests.forEach(q => {
      const row = document.createElement('div');
      const done = q.progress >= q.def.required;
      row.textContent = `${q.def.name}: ${q.progress}/${q.def.required}${done ? ' ✓' : ''}`;
      questHud.appendChild(row);
    });
  }

  function addQuest(def) {
    const quest = { def, progress: 0, completed: false };
    quests.push(quest);
    updateHud();
  }

  function rewardPlayer(reward) {
    if (!reward) return;
    if (typeof player === 'object') {
      if (reward.coins) {
        if (typeof player.coins === 'number') {
          player.coins += reward.coins;
        }
        if (typeof addPlayerFeedbackText === 'function') {
          addPlayerFeedbackText(`+${reward.coins} quest reward`, { color: '#f4d03f', size: 14 });
        }
      }
    }
  }

  function checkQuestCompletion(quest) {
    if (!quest.completed && quest.progress >= quest.def.required) {
      quest.completed = true;
      rewardPlayer(quest.def.reward);
      updateHud();
    }
  }

  function handleKill(enemy) {
    quests.forEach(q => {
      if (q.def.type === 'kill' && !q.completed) {
        const name = (enemy.spriteKey || enemy.name || '').toLowerCase();
        if (name.includes(q.def.target)) {
          q.progress++;
          checkQuestCompletion(q);
        }
      }
    });
  }

  function handleLoot(item) {
    quests.forEach(q => {
      if (q.def.type === 'loot' && !q.completed) {
        const name = (item.type || item.name || '').toLowerCase();
        if (name.includes(q.def.target)) {
          q.progress++;
          checkQuestCompletion(q);
        }
      }
    });
  }

  const origCreateCorpse = typeof createCorpse === 'function' ? createCorpse : null;
  if (origCreateCorpse) {
    window.createCorpse = function(enemy) {
      if (enemy) handleKill(enemy);
      return origCreateCorpse.apply(this, arguments);
    };
  }

  const origMarkCorpseLooted = typeof markCorpseLooted === 'function' ? markCorpseLooted : null;
  if (origMarkCorpseLooted) {
    window.markCorpseLooted = function(corpse, options = {}) {
      if (corpse?.loot && Array.isArray(corpse.loot)) {
        corpse.loot.forEach(item => handleLoot(item));
      }
      return origMarkCorpseLooted.apply(this, arguments);
    };
  }

  function attach() {
    const hud = document.getElementById('hud');
    if (hud && !document.getElementById('questHud')) {
      hud.appendChild(questHud);
    }
    updateHud();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach);
  } else {
    setTimeout(attach, 0);
  }

  QUEST_DEFINITIONS.forEach(addQuest);

  window.activeQuests = quests;
})();
