'use strict';

// 게임 모듈 등록. 각 모듈은 { id, name, emoji, start, onEvent, onPlayerLeave } 형태.
const quiz = require('./quiz');
const catchmind = require('./catchmind');
const wordchain = require('./wordchain');
const reaction = require('./reaction');

module.exports = {
  [quiz.id]: quiz,
  [catchmind.id]: catchmind,
  [wordchain.id]: wordchain,
  [reaction.id]: reaction,
};
