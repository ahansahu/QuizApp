const { useState, useEffect } = React;

const API_URL = window.location.origin;

function App() {
  const [playerName, setPlayerName] = useState('');
  const [playerId, setPlayerId] = useState(localStorage.getItem('playerId'));
  const [state, setState] = useState(null);
  const [bet, setBet] = useState(0);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [answeringStartTime, setAnsweringStartTime] = useState(null);
  const [focusLossCount, setFocusLossCount] = useState(0);
  const [totalFocusLostTime, setTotalFocusLostTime] = useState(0); // Track total time lost
  const [focusLostAt, setFocusLostAt] = useState(null); // Track when focus was lost
  const [prediction, setPrediction] = useState(null); // For spotlight predictions

  const registerPlayer = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    
    try {
      const res = await fetch(`${API_URL}/api/player/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playerName })
      });
      const data = await res.json();
      setPlayerId(data.playerId);
      localStorage.setItem('playerId', data.playerId);
      setError('');
    } catch (err) {
      setError('Connection error. Please try again.');
    }
  };

  const fetchState = async () => {
    if (!playerId) return;
    
    try {
      const res = await fetch(`${API_URL}/api/player/state/${playerId}`);
      if (!res.ok) {
        localStorage.removeItem('playerId');
        setPlayerId(null);
        setBet(0);
        setAnswer('');
        setIsSubmitting(false);
        return;
      }
      const data = await res.json();
      setState(data);
    } catch (err) {
      console.error('Failed to fetch state:', err);
    }
  };

  useEffect(() => {
    if (playerId) {
      fetchState();
      const interval = setInterval(fetchState, 1000);
      return () => clearInterval(interval);
    }
  }, [playerId]);

  useEffect(() => {
    const handleBlur = () => {
      // Track in answering or poker-answering phase AND haven't submitted yet
      if ((state?.phase === 'answering' || state?.phase === 'poker-answering') && !state?.hasSubmittedAnswer) {
        setFocusLossCount(prev => prev + 1);
        setFocusLostAt(Date.now()); // Record when focus was lost
      }
    };

    const handleFocus = () => {
      // Calculate how long focus was lost
      if (focusLostAt && (state?.phase === 'answering' || state?.phase === 'poker-answering') && !state?.hasSubmittedAnswer) {
        const timeLost = (Date.now() - focusLostAt) / 1000; // in seconds
        setTotalFocusLostTime(prev => prev + timeLost);
        
        // Report to server with both count and duration
        fetch(`${API_URL}/api/player/log-focus-loss`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            playerId, 
            focusLossCount: focusLossCount + 1,
            totalFocusLostTime: totalFocusLostTime + timeLost,
            round: state.currentRound
          })
        }).catch(err => console.error('Failed to log focus loss:', err));
        
        setFocusLostAt(null);
      }
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [state?.phase, state?.hasSubmittedAnswer, state?.currentRound, playerId, focusLossCount, focusLostAt, totalFocusLostTime]);

  useEffect(() => {
    if (state?.phase === 'betting' || state?.phase === 'auction') {
      setBet(0);
    }
    if (state?.phase === 'spotlight') {
      setPrediction(null); // Reset prediction when entering spotlight phase
    }
    if (state?.phase === 'poker' || state?.phase === 'poker-answering') {
      setAnswer(''); // Reset answer when entering poker phase
      setIsSubmitting(false);
    }
  }, [state?.phase, state?.currentRound]);

  useEffect(() => {
    if (state?.phase === 'answering' || state?.phase === 'poker-answering') {
      setAnswer('');
      setIsSubmitting(false);
      setFocusLossCount(0);
      setTotalFocusLostTime(0); // Reset time counter
      setFocusLostAt(null); // Reset focus lost timestamp
      
      if (!answeringStartTime) {
        setAnsweringStartTime(Date.now());
      }
    } else {
      setAnsweringStartTime(null);
    }
  }, [state?.phase, state?.currentRound]);

  const submitBet = async (betAmount = bet) => {
    try {
      await fetch(`${API_URL}/api/player/submit-bet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, bet: betAmount })
      });
      fetchState();
    } catch (err) {
      setError('Failed to submit bet');
    }
  };

  const submitAnswer = async () => {
    if (!answer.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    
    const timeTaken = answeringStartTime 
      ? ((Date.now() - answeringStartTime) / 1000).toFixed(4)
      : null;
    
    try {
      await fetch(`${API_URL}/api/player/submit-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          playerId, 
          answer,
          timeTaken
        })
      });
      fetchState();
    } catch (err) {
      setError('Failed to submit answer');
      setIsSubmitting(false);
    }
  };

  if (!playerId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">🎯</div>
            <h1 className="text-3xl font-bold text-white">Join Quiz</h1>
          </div>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white placeholder-gray-500 rounded-lg mb-4 text-lg"
            onKeyPress={(e) => e.key === 'Enter' && registerPlayer()}
          />
          {error && (
            <div className="mb-4 p-3 bg-red-900 border border-red-700 text-red-200 rounded-lg text-sm">
              {error}
            </div>
          )}
          <button
            onClick={registerPlayer}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold text-lg transition"
          >
            Join Game
          </button>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  if (state.phase === 'registration') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">⏳</div>
          <h2 className="text-2xl font-bold mb-4 text-white">Welcome, {state.player.name}!</h2>
          <p className="text-gray-400 text-lg mb-4">Waiting for quiz master to start the game...</p>
          <div className="mt-6 p-6 bg-gray-700 border border-gray-600 rounded-lg">
            <div className="text-sm text-gray-400 mb-2">Your starting points</div>
            <div className="text-4xl font-bold text-blue-400">{state.player.points}</div>
          </div>
        </div>
      </div>
    );
  }

  if (state.phase === 'betting') {
    const maxBet = Math.max(0, state.player.points);
    const canBet = maxBet >= 2;
    
    const increaseBet = () => {
      if (bet === 0) {
        setBet(2);
      } else if (bet < maxBet) {
        setBet(bet + 1);
      }
    };

    const decreaseBet = () => {
      if (bet === 2) {
        setBet(0);
      } else if (bet > 0) {
        setBet(bet - 1);
      }
    };
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-2 text-white">{state.player.name}</h2>
            <div className="text-4xl font-bold text-blue-400">{state.player.points} points</div>
            <div className="text-sm text-gray-400 mt-2">Round {state.currentRound}</div>
          </div>
          
          <h3 className="text-xl font-semibold mb-4 text-center text-white">💰 Place Your Bet</h3>
          
          {canBet ? (
            <>
              <div className="flex items-center justify-center gap-4 mb-6">
                <button
                  onClick={decreaseBet}
                  disabled={state.hasSubmittedBet || bet === 0}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white w-16 h-16 rounded-lg text-3xl font-bold transition flex items-center justify-center"
                >
                  −
                </button>
                <div className="text-center min-w-32">
                  <div className="text-6xl font-bold text-blue-400">{bet}</div>
                  <div className="text-gray-400 text-sm">points</div>
                </div>
                <button
                  onClick={increaseBet}
                  disabled={state.hasSubmittedBet || bet >= maxBet}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white w-16 h-16 rounded-lg text-3xl font-bold transition flex items-center justify-center"
                >
                  +
                </button>
              </div>
              
              {bet === 0 && (
                <div className="text-center text-sm text-green-400 mb-4 font-semibold">
                  ✨ +1 point if correct!
                </div>
              )}
              <div className="text-center text-xs text-gray-500 mb-4">
                (Bets of 1 point not allowed)
              </div>
              
              <button
                onClick={() => submitBet(bet)}
                disabled={state.hasSubmittedBet}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-4 rounded-lg font-semibold text-lg transition"
              >
                {state.hasSubmittedBet ? '✓ Bet Submitted!' : 'Submit Bet'}
              </button>
            </>
          ) : (
            <>
              <div className="text-center mb-6 p-6 bg-gray-700 border border-gray-600 rounded-lg">
                <div className="text-2xl mb-2">😅</div>
                <div className="text-lg text-gray-300">You have {maxBet} points</div>
                <div className="text-sm text-gray-400 mt-2">You can only bet 0 this round</div>
                <div className="text-xs text-green-400 mt-2 font-semibold">
                  ✨ Get it right for +1 point!
                </div>
              </div>
              
              <button
                onClick={() => submitBet(0)}
                disabled={state.hasSubmittedBet}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-4 rounded-lg font-semibold text-lg transition"
              >
                {state.hasSubmittedBet ? '✓ Bet Submitted (0 pts)' : 'Bet 0 Points'}
              </button>
            </>
          )}
          
          {state.hasSubmittedBet && (
            <div className="mt-4 p-4 bg-gray-700 border border-gray-600 rounded-lg text-center">
              <div className="text-green-400 font-semibold">
                Waiting for other players...
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (state.phase === 'answering') {
    const submittedAnswer = state.hasSubmittedAnswer;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-2 text-white">{state.player.name}</h2>
            {state.bettingEnabled && state.result?.bet !== undefined ? (
              <div className="text-gray-400">Your bet: {state.result.bet} points</div>
            ) : (
              <div className="text-gray-400">Answer the question</div>
            )}
            <div className="text-sm text-gray-500 mt-2">Round {state.currentRound}</div>
          </div>
          
          <h3 className="text-xl font-semibold mb-4 text-center text-white">✍️ Your Answer</h3>
          
          {submittedAnswer ? (
            <div className="mb-4 p-4 bg-gray-700 border border-gray-600 rounded-lg">
              <div className="text-gray-300 whitespace-pre-wrap">{answer || '(loading...)'}</div>
            </div>
          ) : (
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer here..."
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white placeholder-gray-500 rounded-lg mb-4 h-32 resize-none text-lg"
            />
          )}
          
          {!submittedAnswer && !state.answeringLocked && (
            <button
              onClick={submitAnswer}
              disabled={!answer.trim() || isSubmitting || submittedAnswer}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-4 rounded-lg font-semibold text-lg transition"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Answer'}
            </button>
          )}
          
          {!submittedAnswer && state.answeringLocked && (
            <div className="mt-4 p-4 bg-red-900 border border-red-600 rounded-lg text-center">
              <div className="text-red-400 font-semibold">
                ⏱️ Time's up! Answering period has ended.
              </div>
            </div>
          )}
          
          {submittedAnswer && (
            <div className="mt-4 p-4 bg-gray-700 border border-gray-600 rounded-lg text-center">
              <div className="text-blue-400 font-semibold">
                Answer submitted! Waiting for quiz master...
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (state.phase === 'auction') {
    const maxBet = Math.max(0, state.player.points);
    
    const increaseBid = () => {
      if (bet < maxBet) {
        setBet(bet + 1);
      }
    };

    const decreaseBid = () => {
      if (bet > 0) {
        setBet(bet - 1);
      }
    };
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-900 via-yellow-800 to-orange-900 flex items-center justify-center p-4">
        <div className="bg-gray-900 border-4 border-yellow-500 rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4 animate-pulse">🔨</div>
            <div className="bg-yellow-500 text-gray-900 px-4 py-2 rounded-lg mb-4 font-black text-xl">
              ⚡ AUCTION ROUND ⚡
            </div>
            <h2 className="text-2xl font-bold mb-2 text-white">{state.player.name}</h2>
            <div className="text-4xl font-bold text-yellow-400">{state.player.points} points</div>
          </div>
          
          <div className="bg-yellow-500/20 border-2 border-yellow-500 rounded-lg p-4 mb-4">
            <h3 className="text-xl font-bold text-center text-yellow-300 mb-2">🏆 Place Your Bid 🏆</h3>
            <p className="text-sm text-center text-gray-300">Highest bid wins!</p>
          </div>
          
          <div className="flex items-center justify-center gap-4 mb-6">
            <button
              onClick={decreaseBid}
              disabled={state.hasSubmittedBet || bet === 0}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white w-16 h-16 rounded-lg text-3xl font-bold transition flex items-center justify-center"
            >
              −
            </button>
            <div className="text-center min-w-32">
              <div className="text-6xl font-bold text-yellow-400">{bet}</div>
              <div className="text-gray-300 text-sm">points</div>
            </div>
            <button
              onClick={increaseBid}
              disabled={state.hasSubmittedBet || bet >= maxBet}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white w-16 h-16 rounded-lg text-3xl font-bold transition flex items-center justify-center"
            >
              +
            </button>
          </div>
          
          <button
            onClick={() => submitBet(bet)}
            disabled={state.hasSubmittedBet}
            className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 text-gray-900 font-black py-4 rounded-lg text-xl transition transform hover:scale-105"
          >
            {state.hasSubmittedBet ? '✓ BID SUBMITTED!' : '🔨 SUBMIT BID'}
          </button>
          
          {state.hasSubmittedBet && (
            <div className="mt-4 p-4 bg-yellow-500/20 border-2 border-yellow-500 rounded-lg text-center animate-pulse">
              <div className="text-yellow-300 font-bold">
                ⏳ Waiting for auction to close...
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (state.phase === 'auction-results') {
    const isWinner = state.auctionWinner && state.auctionWinner.id === playerId;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center">
            <div className="text-8xl mb-6">
              {isWinner ? '🏆' : '😔'}
            </div>
            
            <h2 className="text-3xl font-bold mb-4 text-white">
              {isWinner ? 'You Won!' : 'Auction Lost'}
            </h2>
            
            {state.auctionWinner && (
              <div className="mb-6 p-6 bg-gray-700 border border-gray-600 rounded-lg">
                <div className="text-sm text-gray-400 mb-2">Winner</div>
                <div className="text-2xl font-bold text-yellow-400 mb-2">
                  {state.auctionWinner.name}
                </div>
                <div className="text-lg text-gray-300">
                  Winning Bid: {state.auctionWinner.bid} points
                </div>
              </div>
            )}
            
            <div className="p-6 bg-blue-900 border-2 border-blue-600 rounded-lg">
              <div className="text-sm text-gray-400 mb-2">Your Total Points</div>
              <div className="text-6xl font-bold text-blue-400">
                {state.player.points}
              </div>
            </div>
            
            <div className="mt-6 text-gray-500 text-sm">
              Waiting for next round...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state.phase === 'results') {
    // Check if there's a poker result to show
    if (state.pokerResult) {
      const result = state.result || {};
      const isCorrect = result.correct;
      const pokerWinnings = result.pokerWinnings || 0;
      const pokerLoss = result.pokerLoss || 0;
      
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <div className="text-center">
              <div className="text-8xl mb-6">
                {isCorrect ? '🎉' : '💔'}
              </div>
              
              <h2 className="text-3xl font-bold mb-4 text-white">
                {isCorrect ? 'Winner!' : 'Not this time!'}
              </h2>
              
              {pokerWinnings > 0 && (
                <div className="mb-6 p-6 bg-yellow-900 border-2 border-yellow-600 rounded-lg">
                  <div className="text-sm text-gray-400 mb-2">You Won From The Pot</div>
                  <div className="text-6xl font-bold text-yellow-400">
                    +{pokerWinnings}
                  </div>
                </div>
              )}
              
              {!isCorrect && pokerLoss > 0 && (
                <div className="mb-6 p-6 bg-gray-700 border border-gray-600 rounded-lg">
                  <div className="text-xl text-gray-400">
                    You lost your bet of {pokerLoss} pts
                  </div>
                </div>
              )}
              
              <div className="p-6 bg-blue-900 border-2 border-blue-600 rounded-lg">
                <div className="text-sm text-gray-400 mb-2">Your Total Points</div>
                <div className="text-6xl font-bold text-blue-400">
                  {state.player.points}
                </div>
              </div>
              
              <div className="mt-6 text-gray-500 text-sm">
                Waiting for quiz master...
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    // Check if there's a spotlight result to show
    if (state.spotlightResult) {
      const spotlightResult = state.spotlightResult;
      const wasSpotlightPlayer = spotlightResult.playerId === playerId;
      
      // Determine points earned
      let pointsEarned = 0;
      let outcomeMessage = '';
      let emoji = '🔮';
      
      if (wasSpotlightPlayer) {
        pointsEarned = spotlightResult.correct ? 10 : -2;
        outcomeMessage = spotlightResult.correct ? 'You were correct!' : 'You were wrong!';
        emoji = spotlightResult.correct ? '✅' : '❌';
      } else {
        // Check if they predicted correctly
        const playerPrediction = spotlightResult.predictions?.[playerId];
        if (playerPrediction) {
          const predictedCorrectly = (playerPrediction === 'correct' && spotlightResult.correct) || 
                                     (playerPrediction === 'wrong' && !spotlightResult.correct);
          pointsEarned = predictedCorrectly ? 5 : 0;
          outcomeMessage = predictedCorrectly ? 'Your prediction was correct!' : 'Your prediction was wrong!';
          emoji = predictedCorrectly ? '✅' : '❌';
        } else {
          outcomeMessage = "You didn't predict";
          emoji = '⭐';
        }
      }
      
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <div className="text-center">
              <div className="text-8xl mb-6">{emoji}</div>
              
              <h2 className="text-3xl font-bold text-white mb-4">
                Spotlight Results
              </h2>
              
              <div className="mb-6 p-6 bg-gray-700 border border-gray-600 rounded-lg">
                <div className="text-xl text-white mb-2">
                  {spotlightResult.playerName} was <span className={spotlightResult.correct ? 'text-green-400' : 'text-red-400'}>
                    {spotlightResult.correct ? 'CORRECT ✓' : 'WRONG ✗'}
                  </span>
                </div>
                <div className="text-lg text-gray-400 mt-4">{outcomeMessage}</div>
              </div>
              
              {pointsEarned !== 0 && (
                <div className="mb-6 p-6 bg-gray-700 border border-gray-600 rounded-lg">
                  <div className="text-sm text-gray-400 mb-2">Points Change</div>
                  <div className={`text-5xl font-bold ${pointsEarned >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {pointsEarned >= 0 ? '+' : ''}{pointsEarned}
                  </div>
                </div>
              )}
              
              <div className="p-6 bg-blue-900 border-2 border-blue-600 rounded-lg">
                <div className="text-sm text-gray-400 mb-2">Your Total Points</div>
                <div className="text-6xl font-bold text-blue-400">
                  {state.player.points}
                </div>
              </div>
              
              <div className="mt-6 text-gray-500 text-sm">
                Waiting for quiz master...
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    // Normal results display (no spotlight)
    const result = state.result || {};
    const isCorrect = result.correct;
    const pointsChange = result.pointsChange || 0;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center">
            <div className="text-8xl mb-6">
              {isCorrect ? '✅' : '❌'}
            </div>
            
            <h2 className="text-3xl font-bold mb-4 text-white">
              {isCorrect ? 'Correct!' : 'Wrong!'}
            </h2>
            
            <div className="mb-6 p-6 bg-gray-700 border border-gray-600 rounded-lg">
              <div className="text-sm text-gray-400 mb-2">Points Change</div>
              <div className={`text-5xl font-bold ${pointsChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {pointsChange >= 0 ? '+' : ''}{pointsChange}
              </div>
            </div>
            
            <div className="p-6 bg-blue-900 border-2 border-blue-600 rounded-lg">
              <div className="text-sm text-gray-400 mb-2">Your Total Points</div>
              <div className="text-6xl font-bold text-blue-400">
                {state.player.points}
              </div>
            </div>
            
            <div className="mt-6 text-gray-500 text-sm">
              Waiting for quiz master to start next round...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state.phase === 'spotlight') {
    // Player is in the spotlight
    if (state.isSpotlightPlayer) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-yellow-900 via-yellow-800 to-orange-900 flex items-center justify-center p-4">
          <div className="bg-gray-900 border-4 border-yellow-500 rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <div className="text-center">
              <div className="text-8xl mb-6 animate-pulse">⭐</div>
              <h1 className="text-4xl font-bold text-yellow-400 mb-4">You're in the Spotlight!</h1>
              
              <div className="bg-yellow-500/20 border-2 border-yellow-500 rounded-xl p-6 mb-6">
                <p className="text-xl text-white mb-4">Special scoring for this question:</p>
                <div className="space-y-2 text-lg">
                  <div className="text-green-400 font-bold">✓ Correct: +10 points</div>
                  <div className="text-red-400 font-bold">✗ Wrong: -2 points</div>
                </div>
              </div>
              
              <div className="p-6 bg-blue-900 border-2 border-blue-600 rounded-lg">
                <div className="text-sm text-gray-400 mb-2">Your Current Points</div>
                <div className="text-5xl font-bold text-blue-400">
                  {state.player.points}
                </div>
              </div>
              
              <div className="mt-6 text-gray-400">
                Waiting for quiz master to grade your answer...
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    // Other players predict the outcome
    const submitPrediction = async (pred) => {
      setPrediction(pred);
      try {
        await fetch(`${API_URL}/api/player/submit-prediction`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId, prediction: pred })
        });
      } catch (err) {
        console.error('Failed to submit prediction:', err);
      }
    };
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center">
            <div className="text-6xl mb-6">🔮</div>
            <h2 className="text-3xl font-bold text-white mb-4">
              {state.spotlightPlayerName} is in the Spotlight
            </h2>
            
            <div className="bg-purple-900/50 border border-purple-600 rounded-lg p-6 mb-6">
              <p className="text-xl text-white mb-2">Predict the outcome!</p>
              <p className="text-green-400 font-bold text-lg">Correct prediction: +5 points</p>
            </div>
            
            {!state.hasSubmittedPrediction && !prediction ? (
              <div className="space-y-3">
                <p className="text-gray-400 mb-4">Will they get it correct or wrong?</p>
                <button
                  onClick={() => submitPrediction('correct')}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-lg font-bold text-xl transition"
                >
                  ✓ They'll be Correct
                </button>
                <button
                  onClick={() => submitPrediction('wrong')}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-lg font-bold text-xl transition"
                >
                  ✗ They'll be Wrong
                </button>
              </div>
            ) : (
              <div className="p-6 bg-gray-700 border border-gray-600 rounded-lg">
                <div className="text-green-400 font-bold text-lg mb-2">
                  Prediction Submitted!
                </div>
                <div className="text-white text-xl">
                  You predicted: {prediction || (state.hasSubmittedPrediction ? 'Submitted' : '')}
                </div>
                <div className="text-gray-400 mt-4">
                  Waiting for quiz master...
                </div>
              </div>
            )}
            
            <div className="mt-6 p-4 bg-blue-900 border border-blue-600 rounded-lg">
              <div className="text-sm text-gray-400">Your Points</div>
              <div className="text-3xl font-bold text-blue-400">{state.player.points}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state.phase === 'poker') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-orange-900 flex items-center justify-center p-4">
        <div className="bg-gray-900 border-4 border-red-500 rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center">
            <div className="text-8xl mb-6 animate-pulse">♠️</div>
            <h1 className="text-4xl font-bold text-red-400 mb-4">Poker Round!</h1>
            
            <div className="bg-red-500/20 border-2 border-red-500 rounded-xl p-6 mb-6">
              <p className="text-xl text-white mb-4">You've been forced to bet:</p>
              <div className="text-6xl font-bold text-red-400 mb-4">{state.pokerBet} pts</div>
              <p className="text-gray-300">Winner(s) take all!</p>
            </div>
            
            <div className="p-6 bg-blue-900 border-2 border-blue-600 rounded-lg mb-4">
              <div className="text-sm text-gray-400 mb-2">Your Remaining Points</div>
              <div className="text-5xl font-bold text-blue-400">
                {state.player.points}
              </div>
            </div>
            
            <div className="p-6 bg-gray-700 border-2 border-gray-600 rounded-lg">
              <div className="text-sm text-gray-400 mb-2">Total Pot</div>
              <div className="text-4xl font-bold text-yellow-400">
                {state.pokerPot} pts
              </div>
            </div>
            
            <div className="mt-6 text-gray-400">
              Waiting for quiz master to start question...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state.phase === 'poker-answering') {
    const submittedAnswer = state.hasSubmittedAnswer;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="text-5xl mb-4">♠️</div>
            <h2 className="text-2xl font-bold mb-2 text-white">{state.player.name}</h2>
            <div className="text-4xl font-bold text-blue-400">{state.player.points} points</div>
            <div className="text-sm text-gray-400 mt-2">Round {state.currentRound}</div>
            <div className="text-yellow-400 font-bold mt-2">Pot: {state.pokerPot} pts</div>
          </div>
          
          <h3 className="text-xl font-semibold mb-4 text-center text-white">📝 Answer the Question</h3>
          
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your answer here..."
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white placeholder-gray-500 rounded-lg mb-4 text-lg min-h-32 resize-none"
            disabled={submittedAnswer}
          />
          
          {!submittedAnswer && !state.answeringLocked && (
            <button
              onClick={submitAnswer}
              disabled={!answer.trim() || isSubmitting || submittedAnswer}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-4 rounded-lg font-semibold text-lg transition"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Answer'}
            </button>
          )}
          
          {!submittedAnswer && state.answeringLocked && (
            <div className="mt-4 p-4 bg-red-900 border border-red-600 rounded-lg text-center">
              <div className="text-red-400 font-semibold">
                ⏱️ Time's up! Answering period has ended.
              </div>
            </div>
          )}
          
          {submittedAnswer && (
            <div className="mt-4 p-4 bg-gray-700 border border-gray-600 rounded-lg text-center">
              <div className="text-blue-400 font-semibold">
                Answer submitted! Waiting for quiz master...
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (state.phase === 'leaderboard') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🏆</div>
            <h1 className="text-4xl font-bold text-white mb-2">Game Over!</h1>
            <p className="text-gray-400">Final Results</p>
          </div>

          <div className="p-8 bg-blue-900 border-2 border-blue-600 rounded-xl">
            <div className="text-center">
              <div className="text-2xl font-bold text-white mb-2">{state.player.name}</div>
              <div className="text-6xl font-bold text-blue-400 mb-2">{state.player.points}</div>
              <div className="text-sm text-gray-400">points</div>
            </div>
          </div>

          <div className="mt-8 text-center text-gray-400 text-sm">
            Thanks for playing! 🎉
          </div>
        </div>
      </div>
    );
  }

  return null;
}

ReactDOM.render(<App />, document.getElementById('app'));