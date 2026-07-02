'use strict';

// 게임 모듈 등록. 각 모듈은 { id, name, emoji, minPlayers, start, onEvent, onPlayerLeave } 형태.
const modules = [
  require('./racing'),
  require('./math'),
  require('./chosung'),
  require('./vote'),
  require('./mole'),
  require('./memory'),
  require('./liar'),
  require('./board'),
  require('./telestration'),
  require('./bingo'),
  require('./typing'),
];

const registry = {};
for (const m of modules) registry[m.id] = m;

module.exports = registry;
