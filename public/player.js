const { useState, useEffect } = React;

const API_URL = window.location.origin;

function App() {
  const [playerName, setPlayerName] = useState('');
  const [playerId, setPlayerId] = useState(localStorage.getItem('playerId'));
  const [state, setState] = useState(null);
  const [bet, setBet] = useState(0);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');

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
        // Player might have been reset
        localStorage.removeItem('playerId');
        setPlayerId(null);
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

  // Reset bet to 0 when phase changes to betting
  useEffect(() => {
    if (state?.phase === 'betting') {
      setBet(0);
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
    if (!answer.trim()) return;
    
    try {
      await fetch(`${API_URL}/api/player/submit-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, answer })
      });
      // Don't clear answer - keep it to display
      fetchState();
    } catch (err) {
      setError('Failed to submit answer');
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
    const canBet = maxBet >= 2; // Can only bet if you have 2 or more points
    
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
              <input
                type="range"
                min="0"
                max={maxBet}
                step="1"
                value={Math.max(0, Math.min(bet, maxBet))}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  // Skip 1, only allow 0 or 2+
                  if (val === 1) {
                    setBet(bet < 1 ? 0 : 2);
                  } else {
                    setBet(val);
                  }
                }}
                className="w-full mb-4 h-3 rounded-lg appearance-none cursor-pointer"
                disabled={state.hasSubmittedBet}
              />
              
              <div className="text-center mb-6">
                <div className="text-5xl font-bold text-blue-400">{bet === 1 ? 0 : bet}</div>
                <div className="text-gray-400">points</div>
                {bet === 0 && (
                  <div className="text-sm text-green-400 mt-2 font-semibold">
                    ✨ +1 point if correct!
                  </div>
                )}
                <div className="text-xs text-gray-500 mt-2">
                  (Bets of 1 point not allowed)
                </div>
              </div>
              
              <button
                onClick={() => submitBet(bet === 1 ? 0 : bet)}
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
    const submittedAnswer = state.result?.bet !== undefined ? state.hasSubmittedAnswer : false;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-2 text-white">{state.player.name}</h2>
            <div className="text-gray-400">Your bet: {state.result?.bet ?? 0} points</div>
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
          
          {!submittedAnswer && (
            <button
              onClick={submitAnswer}
              disabled={!answer.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-4 rounded-lg font-semibold text-lg transition"
            >
              Submit Answer
            </button>
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
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">🔨</div>
            <h2 className="text-2xl font-bold mb-2 text-white">{state.player.name}</h2>
            <div className="text-4xl font-bold text-yellow-400">{state.player.points} points</div>
          </div>
          
          <h3 className="text-xl font-semibold mb-4 text-center text-white">Place Your Bid</h3>
          
          <input
            type="range"
            min="0"
            max={maxBet}
            value={Math.min(bet, maxBet)}
            onChange={(e) => setBet(parseInt(e.target.value))}
            className="w-full mb-4 h-3 rounded-lg appearance-none cursor-pointer"
            disabled={state.hasSubmittedBet}
          />
          
          <div className="text-center mb-6">
            <div className="text-5xl font-bold text-yellow-400">{Math.min(bet, maxBet)}</div>
            <div className="text-gray-400">points</div>
          </div>
          
          <button
            onClick={() => submitBet(Math.min(bet, maxBet))}
            disabled={state.hasSubmittedBet}
            className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white py-4 rounded-lg font-semibold text-lg transition"
          >
            {state.hasSubmittedBet ? '✓ Bid Submitted!' : 'Submit Bid'}
          </button>
          
          {state.hasSubmittedBet && (
            <div className="mt-4 p-4 bg-gray-700 border border-gray-600 rounded-lg text-center">
              <div className="text-yellow-400 font-semibold">
                Waiting for auction to close...
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