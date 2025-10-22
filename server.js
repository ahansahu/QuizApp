const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// IMPORTANT: Change this password before deploying!
const QUIZ_MASTER_PASSWORD = 'quiz';

// In-memory game state
const gameState = {
  players: {},
  currentRound: 0,
  phase: 'registration', // registration, betting, answering, results, auction, auction-results, leaderboard
  answers: {},
  auctionWinner: null,
  bettingEnabled: true // Toggle for betting rounds
};

// Quiz Master endpoints
app.post('/api/master/login', (req, res) => {
  const { password } = req.body;
  if (password === QUIZ_MASTER_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: 'Invalid password' });
  }
});

app.get('/api/master/state', (req, res) => {
  res.json(gameState);
});

app.post('/api/master/start-quiz', (req, res) => {
  gameState.currentRound = 1;
  gameState.answers = {};
  
  // Check if betting is enabled for first round
  if (gameState.bettingEnabled) {
    gameState.phase = 'betting';
  } else {
    gameState.phase = 'answering';
    gameState.answeringStartTime = Date.now();
  }
  
  res.json(gameState);
});

app.post('/api/master/next-round', (req, res) => {
  // Points already deducted in show-results, just move to next round
  gameState.currentRound += 1;
  gameState.answers = {};
  
  // Check if betting is enabled for this round
  if (gameState.bettingEnabled) {
    gameState.phase = 'betting';
  } else {
    gameState.phase = 'answering';
    gameState.answeringStartTime = Date.now();
  }
  
  res.json(gameState);
});

app.post('/api/master/toggle-betting', (req, res) => {
  const { enabled } = req.body;
  gameState.bettingEnabled = enabled;
  res.json(gameState);
});

app.post('/api/master/advance-to-answering', (req, res) => {
  gameState.phase = 'answering';
  // No longer need server-side start time since client handles timing
  res.json(gameState);
});

app.post('/api/master/mark-answer', (req, res) => {
  const { playerId, correct } = req.body;
  const player = gameState.players[playerId];
  const bet = gameState.answers[playerId]?.bet !== undefined ? gameState.answers[playerId].bet : 0;
  
  let pointsChange = 0;
  
  // If betting was disabled for this round, use simple 1/0 scoring
  if (!gameState.bettingEnabled || bet === undefined) {
    if (correct) {
      pointsChange = 1;
      player.points += 1;
    } else {
      pointsChange = 0;
    }
  } else {
    // Normal betting scoring
    if (correct) {
      if (bet === 0) {
        pointsChange = 1; // Bonus point for correct answer with 0 bet
        player.points += 1;
      } else {
        pointsChange = bet; // Win the amount you bet (not double)
        player.points += bet;
      }
    } else {
      pointsChange = -bet;
      player.points -= bet;
    }
  }
  
  // Mark this answer as graded and store result
  if (gameState.answers[playerId]) {
    gameState.answers[playerId].graded = true;
    gameState.answers[playerId].correct = correct;
    gameState.answers[playerId].pointsChange = pointsChange;
  }
  
  res.json(gameState);
});

app.post('/api/master/adjust-score', (req, res) => {
  const { playerId, change } = req.body;
  const player = gameState.players[playerId];
  
  if (player) {
    player.points += change;
  }
  
  res.json(gameState);
});

app.post('/api/master/undo-grading', (req, res) => {
  const { playerId } = req.body;
  const player = gameState.players[playerId];
  const answer = gameState.answers[playerId];
  
  if (player && answer && answer.graded) {
    // Reverse the point change
    if (answer.pointsChange !== undefined) {
      player.points -= answer.pointsChange;
    }
    
    // Clear grading status
    answer.graded = false;
    delete answer.correct;
    delete answer.pointsChange;
  }
  
  res.json(gameState);
});

app.post('/api/master/show-results', (req, res) => {
  // Auto-judge players who didn't submit answers as wrong BEFORE showing results
  Object.keys(gameState.players).forEach(playerId => {
    const playerAnswer = gameState.answers[playerId];
    // If player bet but didn't submit answer, mark as wrong and deduct points
    if (playerAnswer && playerAnswer.bet !== undefined && !playerAnswer.answer) {
      const bet = playerAnswer.bet;
      gameState.players[playerId].points -= bet;
      
      // Mark as graded with wrong result
      playerAnswer.graded = true;
      playerAnswer.correct = false;
      playerAnswer.pointsChange = -bet;
      playerAnswer.answer = '(no answer submitted)';
    }
  });
  
  gameState.phase = 'results';
  res.json(gameState);
});

app.post('/api/master/start-auction', (req, res) => {
  gameState.phase = 'auction';
  gameState.answers = {};
  gameState.auctionWinner = null;
  res.json(gameState);
});

app.post('/api/master/end-auction', (req, res) => {
  // Find the highest bidder
  let highestBid = -1;
  let winnerId = null;
  
  Object.keys(gameState.answers).forEach(playerId => {
    const bid = gameState.answers[playerId]?.bet || 0;
    if (bid > highestBid) {
      highestBid = bid;
      winnerId = playerId;
    }
  });
  
  // Deduct points from winner
  if (winnerId && highestBid > 0) {
    gameState.players[winnerId].points -= highestBid;
    gameState.auctionWinner = {
      id: winnerId,
      name: gameState.players[winnerId].name,
      bid: highestBid
    };
  }
  
  gameState.phase = 'auction-results';
  res.json(gameState);
});

app.post('/api/master/remove-player', (req, res) => {
  const { playerId } = req.body;
  
  // Remove player from game state
  delete gameState.players[playerId];
  
  // Remove ALL their data (answers, bets, etc.)
  delete gameState.answers[playerId];
  
  // If they were the auction winner, clear that too
  if (gameState.auctionWinner && gameState.auctionWinner.id === playerId) {
    gameState.auctionWinner = null;
  }
  
  res.json(gameState);
});

app.post('/api/master/end-game', (req, res) => {
  gameState.phase = 'leaderboard';
  res.json(gameState);
});

app.post('/api/master/reset-game', (req, res) => {
  gameState.players = {};
  gameState.currentRound = 0;
  gameState.phase = 'registration';
  gameState.answers = {};
  res.json(gameState);
});

// Player endpoints
app.post('/api/player/register', (req, res) => {
  const { name } = req.body;
  const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
  gameState.players[id] = {
    name,
    points: 5  // START WITH 5 POINTS
  };
  res.json({ playerId: id, player: gameState.players[id] });
});

app.get('/api/player/state/:playerId', (req, res) => {
  const { playerId } = req.params;
  const player = gameState.players[playerId];
  
  if (!player) {
    return res.status(404).json({ error: 'Player not found' });
  }
  
  res.json({
    phase: gameState.phase,
    currentRound: gameState.currentRound,
    player: player,
    bettingEnabled: gameState.bettingEnabled,
    hasSubmittedBet: gameState.answers[playerId]?.bet !== undefined,
    hasSubmittedAnswer: !!gameState.answers[playerId]?.answer,
    isGraded: !!gameState.answers[playerId]?.graded,
    auctionWinner: gameState.auctionWinner,
    result: gameState.answers[playerId] ? {
      correct: gameState.answers[playerId].correct,
      bet: gameState.answers[playerId].bet,
      pointsChange: gameState.answers[playerId].pointsChange
    } : null
  });
});

app.post('/api/player/submit-bet', (req, res) => {
  const { playerId, bet } = req.body;
  if (!gameState.answers[playerId]) {
    gameState.answers[playerId] = {};
  }
  gameState.answers[playerId].bet = parseInt(bet);
  res.json({ success: true });
});

app.post('/api/player/submit-answer', (req, res) => {
  const { playerId, answer, timeTaken } = req.body;
  if (!gameState.answers[playerId]) {
    gameState.answers[playerId] = {};
  }
  gameState.answers[playerId].answer = answer;
  
  // Use client-provided time (already formatted to 4 decimal places)
  if (timeTaken) {
    gameState.answers[playerId].timeTaken = timeTaken;
  }
  
  res.json({ success: true });
});

app.post('/api/player/log-focus-loss', (req, res) => {
  const { playerId, focusLossCount, totalFocusLostTime, round } = req.body;
  
  // Store focus loss count and duration for this player in this round
  if (!gameState.answers[playerId]) {
    gameState.answers[playerId] = {};
  }
  
  gameState.answers[playerId].focusLosses = focusLossCount;
  gameState.answers[playerId].focusLostTime = totalFocusLostTime ? totalFocusLostTime.toFixed(2) : 0;
  
  res.json({ success: true });
});

app.get('/api/leaderboard', (req, res) => {
  // Return sorted players for live leaderboard
  const players = Object.entries(gameState.players).map(([id, player]) => ({
    id,
    name: player.name,
    points: player.points
  }));
  
  players.sort((a, b) => b.points - a.points);
  
  res.json({
    players,
    currentRound: gameState.currentRound,
    phase: gameState.phase
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🎮 Quiz Master Server Running!\n`);
  console.log(`Quiz Master Panel: http://localhost:${PORT}/master.html`);
  console.log(`Player Link: http://localhost:${PORT}/player.html\n`);
});