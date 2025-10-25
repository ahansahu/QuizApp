const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// IMPORTANT: Change this password before deploying!
const QUIZ_MASTER_PASSWORD = 'thequizzler';

// In-memory game state
const gameState = {
  players: {},
  currentRound: 0,
  phase: 'registration', // registration, betting, answering, results, auction, auction-results, leaderboard, spotlight, poker, poker-answering, poker-results
  answers: {},
  auctionWinner: null,
  bettingEnabled: true, // Toggle for betting rounds
  spotlightPlayerId: null, // ID of player in spotlight
  spotlightPredictions: {}, // playerId: 'correct' or 'wrong'
  pokerPot: 0, // Total points in the poker pot
  pokerBets: {}, // playerId: betAmount
  answeringLocked: false // Whether players can submit answers
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
  gameState.spotlightResult = null; // Clear spotlight result
  gameState.pokerPot = 0; // Clear poker pot
  gameState.pokerBets = {}; // Clear poker bets
  gameState.pokerResult = null; // Clear poker result
  gameState.answeringLocked = false; // Reset answering lock
  
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

app.post('/api/master/lock-answering', (req, res) => {
  gameState.answeringLocked = true;
  res.json(gameState);
});

app.post('/api/master/advance-to-answering', (req, res) => {
  gameState.phase = 'answering';
  gameState.answeringLocked = false; // Unlock when starting answering
  // No longer need server-side start time since client handles timing
  res.json(gameState);
});

app.post('/api/master/mark-answer', (req, res) => {
  const { playerId, correct } = req.body;
  const player = gameState.players[playerId];
  const bet = gameState.answers[playerId]?.bet !== undefined ? gameState.answers[playerId].bet : 0;
  
  let pointsChange = 0;
  
  // If in poker-answering phase, don't give any flat points - only pot split
  if (gameState.phase === 'poker-answering') {
    // Just mark as correct/wrong, points will be distributed when showing results
    pointsChange = 0;
  }
  // If betting was disabled for this round, use simple 1/0 scoring
  else if (!gameState.bettingEnabled || bet === undefined) {
    if (correct) {
      pointsChange = 2; // 2 points for correct answer when betting is off
      player.points += 2;
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

app.post('/api/master/start-spotlight', (req, res) => {
  const { playerId } = req.body;
  gameState.phase = 'spotlight';
  gameState.spotlightPlayerId = playerId;
  gameState.spotlightPredictions = {};
  gameState.pokerResult = null; // Clear poker result
  res.json(gameState);
});

app.post('/api/master/grade-spotlight', (req, res) => {
  const { correct } = req.body;
  const spotlightId = gameState.spotlightPlayerId;
  
  if (spotlightId && gameState.players[spotlightId]) {
    // Award/deduct points for spotlight player
    if (correct) {
      gameState.players[spotlightId].points += 10;
    } else {
      gameState.players[spotlightId].points -= 2;
    }
    
    // Award points to players who predicted correctly
    Object.entries(gameState.spotlightPredictions).forEach(([playerId, prediction]) => {
      if (playerId !== spotlightId) {
        const predictedCorrectly = (prediction === 'correct' && correct) || (prediction === 'wrong' && !correct);
        if (predictedCorrectly) {
          gameState.players[playerId].points += 5;
        }
      }
    });
    
    // Store result for display - each player will see their own outcome
    gameState.spotlightResult = {
      playerId: spotlightId,
      playerName: gameState.players[spotlightId].name,
      correct: correct,
      predictions: {...gameState.spotlightPredictions}
    };
  }
  
  // Go back to results phase, clear spotlight state
  gameState.phase = 'results';
  gameState.spotlightPlayerId = null;
  gameState.spotlightPredictions = {};
  
  res.json(gameState);
});

app.post('/api/master/start-poker', (req, res) => {
  gameState.phase = 'poker';
  gameState.pokerBets = {};
  gameState.pokerPot = 0;
  gameState.answers = {};
  gameState.pokerResult = null; // Clear previous poker result
  gameState.spotlightResult = null; // Clear spotlight result
  
  // Calculate and deduct 10% from each player
  Object.keys(gameState.players).forEach(playerId => {
    const player = gameState.players[playerId];
    let bet;
    
    if (player.points < 10) {
      // Go all in if less than 10 points
      bet = player.points;
    } else {
      // 10% of points, rounded to nearest integer
      bet = Math.round(player.points * 0.1);
    }
    
    // Deduct bet from player
    player.points -= bet;
    gameState.pokerBets[playerId] = bet;
    gameState.pokerPot += bet;
  });
  
  res.json(gameState);
});

app.post('/api/master/poker-to-answering', (req, res) => {
  gameState.phase = 'poker-answering';
  gameState.answeringLocked = false; // Unlock when starting poker answering
  res.json(gameState);
});

app.post('/api/master/show-poker-results', (req, res) => {
  // Auto-judge players who didn't submit answers as wrong
  Object.keys(gameState.players).forEach(playerId => {
    const playerAnswer = gameState.answers[playerId];
    if (!playerAnswer || !playerAnswer.answer) {
      if (!gameState.answers[playerId]) {
        gameState.answers[playerId] = {};
      }
      gameState.answers[playerId].graded = true;
      gameState.answers[playerId].correct = false;
      gameState.answers[playerId].answer = '(no answer submitted)';
    }
  });
  
  // Find all winners (players who answered correctly)
  const winners = [];
  Object.keys(gameState.answers).forEach(playerId => {
    if (gameState.answers[playerId].correct) {
      winners.push(playerId);
    }
  });
  
  // Distribute pot among winners
  if (winners.length > 0) {
    const winningsPerPlayer = Math.floor(gameState.pokerPot / winners.length);
    winners.forEach(playerId => {
      gameState.players[playerId].points += winningsPerPlayer;
      gameState.answers[playerId].pointsChange = winningsPerPlayer;
      gameState.answers[playerId].pokerWinnings = winningsPerPlayer;
    });
  }
  
  // Mark losers with their poker bet loss
  Object.keys(gameState.answers).forEach(playerId => {
    if (!gameState.answers[playerId].correct) {
      gameState.answers[playerId].pointsChange = 0;
      gameState.answers[playerId].pokerLoss = gameState.pokerBets[playerId] || 0;
    }
  });
  
  // Store poker result data and move to results phase
  gameState.pokerResult = {
    pot: gameState.pokerPot,
    winners: winners.length,
    bets: {...gameState.pokerBets}
  };
  
  gameState.phase = 'results';
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
  gameState.pokerResult = null; // Clear poker result
  gameState.spotlightResult = null; // Clear spotlight result
  res.json(gameState);
});

app.post('/api/master/end-auction', (req, res) => {
  // Find the highest bidder with risk-based tie-breaking
  let highestBid = -1;
  let winnerId = null;
  let winnerPoints = Infinity; // Track winner's total points for tie-breaking
  
  Object.keys(gameState.answers).forEach(playerId => {
    const bid = gameState.answers[playerId]?.bet || 0;
    const playerPoints = gameState.players[playerId].points;
    
    // Determine if this player should become the new winner
    if (bid > highestBid) {
      // Higher bid always wins
      highestBid = bid;
      winnerId = playerId;
      winnerPoints = playerPoints;
    } else if (bid === highestBid && bid > 0) {
      // Same bid - use risk-based tie-break
      // Player with fewer points is taking more risk, so they win
      if (playerPoints < winnerPoints) {
        winnerId = playerId;
        winnerPoints = playerPoints;
      }
      // If playerPoints === winnerPoints, first bidder keeps the win (current behavior)
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
    points: 0  // START WITH 0 POINTS
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
    answeringLocked: gameState.answeringLocked,
    hasSubmittedBet: gameState.answers[playerId]?.bet !== undefined,
    hasSubmittedAnswer: !!gameState.answers[playerId]?.answer,
    isGraded: !!gameState.answers[playerId]?.graded,
    auctionWinner: gameState.auctionWinner,
    isSpotlightPlayer: gameState.spotlightPlayerId === playerId,
    spotlightPlayerName: gameState.spotlightPlayerId ? gameState.players[gameState.spotlightPlayerId]?.name : null,
    hasSubmittedPrediction: !!gameState.spotlightPredictions[playerId],
    spotlightResult: gameState.spotlightResult,
    pokerBet: gameState.pokerBets[playerId],
    pokerPot: gameState.pokerPot,
    pokerResult: gameState.pokerResult,
    result: gameState.answers[playerId] ? {
      correct: gameState.answers[playerId].correct,
      bet: gameState.answers[playerId].bet,
      pointsChange: gameState.answers[playerId].pointsChange,
      pokerWinnings: gameState.answers[playerId].pokerWinnings,
      pokerLoss: gameState.answers[playerId].pokerLoss
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
  
  // Check if answering is locked
  if (gameState.answeringLocked) {
    return res.status(403).json({ error: 'Answering period has ended' });
  }
  
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

app.post('/api/player/submit-prediction', (req, res) => {
  const { playerId, prediction } = req.body;
  
  // Only allow predictions during spotlight phase
  if (gameState.phase === 'spotlight') {
    gameState.spotlightPredictions[playerId] = prediction; // 'correct' or 'wrong'
  }
  
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