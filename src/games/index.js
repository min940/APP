'use strict';

// 게임 모듈 등록. 각 모듈은 { id, name, emoji, start, onEvent, onPlayerLeave } 형태.
const { createQuizGame } = require('./quiz');
const catchmind = require('./catchmind');
const wordchain = require('./wordchain');
const reaction = require('./reaction');

// 같은 퀴즈 엔진으로 문제 파일만 바꿔 두 종류를 만든다.
const quiz = createQuizGame({
  id: 'quiz',
  name: '스피드 퀴즈',
  emoji: '🧠',
  dataFile: 'quiz.json',
});
const familyquiz = createQuizGame({
  id: 'familyquiz',
  name: '가족 퀴즈',
  emoji: '👨‍👩‍👧‍👦',
  dataFile: 'family-quiz.json',
});

module.exports = {
  [quiz.id]: quiz,
  [familyquiz.id]: familyquiz,
  [catchmind.id]: catchmind,
  [wordchain.id]: wordchain,
  [reaction.id]: reaction,
};
