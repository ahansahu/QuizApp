const { useState, useEffect } = React;

const API_URL = window.location.origin;

function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [bettingEnabled, setBettingEnabled] = useState(true);

  const login = async () => {
    try {
      const res = await fetch(`${API_URL}/api/master/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (data.success) {
        setAuthenticated(true);
        setError('');
        fetchState();
      } else {
        setError('Invalid password');
      }
    } catch (err) {
      setError('Connection error');
    }
  };

  const fetchState = async () => {
    try {
      const res = await fetch(`${API_URL}/api/master/state`);
      const data = await res.json();
      setState(data);
      setBettingEnabled(data.bettingEnabled);
    } catch (err) {
      console.error('Failed to fetch state:', err);
    }
  };

  useEffect(() => {
    if (authenticated) {
      fetchState();
      const interval = setInterval(fetchState, 1000);
      return () => clearInterval(interval);
    }
  }, [authenticated]);

  const startQuiz = async () => {
    await fetch(`${API_URL}/api/master/start-quiz`, { method: 'POST' });
    fetchState();
  };

  const nextRound = async () => {
    await fetch(`${API_URL}/api/master/next-round`, { method: 'POST' });
    fetchState();
  };

  const advanceToAnswering = async () => {
    await fetch(`${API_URL}/api/master/advance-to-answering`, { method: 'POST' });
    fetchState();
  };

  const showResults = async () => {
    await fetch(`${API_URL}/api/master/show-results`, { method: 'POST' });
    fetchState();
  };

  const startAuction = async () => {
    await fetch(`${API_URL}/api/master/start-auction`, { method: 'POST' });
    fetchState();
  };

  const endAuction = async () => {
    await fetch(`${API_URL}/api/master/end-auction`, { method: 'POST' });
    fetchState();
  };

  const toggleBetting = async (enabled) => {
    setBettingEnabled(enabled);
    await fetch(`${API_URL}/api/master/toggle-betting`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    fetchState();
  };

  const endGame = async () => {
    await fetch(`${API_URL}/api/master/end-game`, { method: 'POST' });
    fetchState();
  };

  const markAnswer = async (playerId, correct) => {
    await fetch(`${API_URL}/api/master/mark-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, correct })
    });
    fetchState();
  };

  const resetGame = async () => {
    if (confirm('Are you sure you want to reset the entire game? This will remove all players and scores.')) {
      await fetch(`${API_URL}/api/master/reset-game`, { method: 'POST' });
      fetchState();
    }
  };

  const removePlayer = async (playerId, playerName) => {
    if (confirm(`Remove ${playerName} from the game?`)) {
      await fetch(`${API_URL}/api/master/remove-player`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId })
      });
      fetchState();
    }
  };

  const adjustScore = async (playerId, change) => {
    await fetch(`${API_URL}/api/master/adjust-score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, change })
    });
    fetchState();
  };

  const undoGrading = async (playerId) => {
    await fetch(`${API_URL}/api/master/undo-grading`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId })
    });
    fetchState();
  };

  const startSpotlight = async (playerId) => {
    await fetch(`${API_URL}/api/master/start-spotlight`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId })
    });
    fetchState();
  };

  const gradeSpotlight = async (correct) => {
    await fetch(`${API_URL}/api/master/grade-spotlight`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correct })
    });
    fetchState();
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">🎮</div>
            <h1 className="text-3xl font-bold text-white">Quiz Master Login</h1>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter master password"
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white placeholder-gray-500 rounded-lg mb-4 text-lg"
            onKeyPress={(e) => e.key === 'Enter' && login()}
          />
          {error && (
            <div className="mb-4 p-3 bg-red-900 border border-red-700 text-red-200 rounded-lg text-sm">
              {error}
            </div>
          )}
          <button
            onClick={login}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold text-lg transition"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  const playerList = Object.entries(state.players);
  const sortedPlayers = [...playerList].sort((a, b) => b[1].points - a[1].points);

  // Leaderboard view
  if (state.phase === 'leaderboard') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-8">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">🏆</div>
              <h1 className="text-5xl font-bold text-white mb-2">Final Leaderboard</h1>
              <p className="text-gray-400">Great job everyone!</p>
            </div>

            <div className="space-y-4 mb-8">
              {sortedPlayers.map(([id, player], index) => {
                const rank = index + 1;
                let medal = '';
                let bgColor = 'bg-gray-700';
                let borderColor = 'border-gray-600';
                
                if (rank === 1) {
                  medal = '🥇';
                  bgColor = 'bg-gradient-to-r from-yellow-600 via-yellow-500 to-yellow-600';
                  borderColor = 'border-yellow-400';
                } else if (rank === 2) {
                  medal = '🥈';
                  bgColor = 'bg-gradient-to-r from-gray-700 to-gray-600';
                  borderColor = 'border-gray-500';
                } else if (rank === 3) {
                  medal = '🥉';
                  bgColor = 'bg-gradient-to-r from-orange-900 to-orange-800';
                  borderColor = 'border-orange-600';
                }

                return (
                  <div
                    key={id}
                    className={`${bgColor} border-2 ${borderColor} rounded-xl p-6 transition transform hover:scale-102`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="text-4xl font-bold text-gray-400 w-12">
                          {rank <= 3 ? medal : `#${rank}`}
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-white">{player.name}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-4xl font-bold text-blue-400">{player.points}</div>
                        <div className="text-sm text-gray-400">points</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-4 justify-center">
              <button
                onClick={resetGame}
                className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-lg text-xl font-semibold transition"
              >
                🔄 Start New Game
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-4 md:p-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
            <h1 className="text-3xl md:text-4xl font-bold text-white">Quiz Master Control</h1>
            <div className="text-left md:text-right">
              <div className="text-sm text-gray-400">Round {state.currentRound}</div>
              <div className="text-2xl font-bold text-blue-400">{state.phase.toUpperCase()}</div>
            </div>
          </div>

          {state.phase === 'registration' && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">👥</div>
              <h2 className="text-2xl font-semibold mb-4 text-white">Waiting for players to register...</h2>
              <p className="text-gray-400 mb-8 text-lg">{playerList.length} players registered</p>
              {playerList.length > 0 && (
                <>
                  <div className="flex items-center justify-center gap-3 mb-6 bg-gray-700 px-6 py-3 rounded-lg border border-gray-600 inline-flex">
                    <span className="text-white text-base">Betting:</span>
                    <button
                      onClick={() => toggleBetting(!bettingEnabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        bettingEnabled ? 'bg-green-500' : 'bg-gray-500'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          bettingEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className={`text-base font-semibold ${bettingEnabled ? 'text-green-400' : 'text-gray-400'}`}>
                      {bettingEnabled ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <br />
                  <button
                    onClick={startQuiz}
                    className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-lg text-xl font-semibold transition inline-flex items-center gap-2"
                  >
                    ▶️ Start Quiz
                  </button>
                </>
              )}
            </div>
          )}

          {(state.phase === 'betting' || state.phase === 'answering' || state.phase === 'results' || state.phase === 'auction' || state.phase === 'auction-results' || state.phase === 'spotlight') && (
            <div className="mb-6 flex flex-wrap gap-3">
              {state.phase === 'spotlight' && (
                <div className="w-full">
                  <div className="bg-yellow-900 border-2 border-yellow-600 rounded-xl p-6 mb-4">
                    <h3 className="text-2xl font-bold text-yellow-300 mb-4 text-center">
                      ⭐ {state.players[state.spotlightPlayerId]?.name} is in the Spotlight!
                    </h3>
                    <p className="text-gray-300 text-center mb-4">Grade their answer:</p>
                    <div className="flex gap-4 justify-center">
                      <button
                        onClick={() => gradeSpotlight(true)}
                        className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-lg font-bold text-xl transition"
                      >
                        ✓ Correct (+10 pts)
                      </button>
                      <button
                        onClick={() => gradeSpotlight(false)}
                        className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-lg font-bold text-xl transition"
                      >
                        ✗ Wrong (-2 pts)
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {state.phase === 'betting' && (
                <button
                  onClick={advanceToAnswering}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition"
                >
                  ⏭️ Skip to Answering
                </button>
              )}
              {state.phase === 'answering' && (
                <button
                  onClick={showResults}
                  className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold transition"
                >
                  📊 Show Results
                </button>
              )}
              {state.phase === 'results' && (
                <>
                  <button
                    onClick={nextRound}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition"
                  >
                    ➡️ Next Round
                  </button>
                  <button
                    onClick={startAuction}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-3 rounded-lg font-semibold transition"
                  >
                    🔨 Start Auction
                  </button>
                  <button
                    onClick={endGame}
                    className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold transition"
                  >
                    🏁 End Game
                  </button>
                  <div className="flex items-center gap-2 bg-gray-700 px-4 py-2 rounded-lg border border-gray-600">
                    <span className="text-white text-sm">Betting:</span>
                    <button
                      onClick={() => toggleBetting(!bettingEnabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        bettingEnabled ? 'bg-green-500' : 'bg-gray-500'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          bettingEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className={`text-sm font-semibold ${bettingEnabled ? 'text-green-400' : 'text-gray-400'}`}>
                      {bettingEnabled ? 'ON' : 'OFF'}
                    </span>
                  </div>
                </>
              )}
              {state.phase === 'auction' && (
                <button
                  onClick={endAuction}
                  className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold transition"
                >
                  📊 Show Auction Results
                </button>
              )}
              {state.phase === 'auction-results' && (
                <>
                  <button
                    onClick={nextRound}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition"
                  >
                    ➡️ Next Round
                  </button>
                  <button
                    onClick={startAuction}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-3 rounded-lg font-semibold transition"
                  >
                    🔨 Start Another Auction
                  </button>
                  <button
                    onClick={endGame}
                    className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold transition"
                  >
                    🏁 End Game
                  </button>
                  <div className="flex items-center gap-2 bg-gray-700 px-4 py-2 rounded-lg border border-gray-600">
                    <span className="text-white text-sm">Betting:</span>
                    <button
                      onClick={() => toggleBetting(!bettingEnabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        bettingEnabled ? 'bg-green-500' : 'bg-gray-500'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          bettingEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className={`text-sm font-semibold ${bettingEnabled ? 'text-green-400' : 'text-gray-400'}`}>
                      {bettingEnabled ? 'ON' : 'OFF'}
                    </span>
                  </div>
                </>
              )}
              <button
                onClick={resetGame}
                className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-semibold transition"
              >
                🔄 Reset Game
              </button>
            </div>
          )}

          <div className="bg-gray-700 rounded-lg p-4 md:p-6">
            {state.phase === 'auction-results' && state.auctionWinner && (
              <div className="mb-6 p-6 bg-yellow-900 border-2 border-yellow-600 rounded-xl text-center">
                <div className="text-5xl mb-3">🔨</div>
                <h2 className="text-3xl font-bold text-white mb-2">Auction Winner!</h2>
                <div className="text-2xl text-yellow-300 font-semibold mb-1">
                  {state.auctionWinner.name}
                </div>
                <div className="text-lg text-gray-300">
                  Winning Bid: {state.auctionWinner.bid} points
                </div>
              </div>
            )}
            
            <h2 className="text-2xl font-semibold mb-4 text-white">Players ({playerList.length})</h2>
            <div className="space-y-3">
              {playerList.map(([id, player]) => (
                <div key={id} className="bg-gray-800 border border-gray-600 p-4 rounded-lg shadow">
                  <div className="flex justify-between items-start gap-4">
                    {/* Left side - Player info */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-semibold text-lg text-white mb-1">{player.name}</div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => adjustScore(id, 1)}
                              className="bg-green-600 hover:bg-green-700 text-white w-6 h-6 rounded text-xs font-bold transition flex items-center justify-center"
                              title="Add 1 point"
                            >
                              ▲
                            </button>
                            <div className="text-xl font-bold text-blue-400">{player.points} pts</div>
                            <button
                              onClick={() => adjustScore(id, -1)}
                              className="bg-red-600 hover:bg-red-700 text-white w-6 h-6 rounded text-xs font-bold transition flex items-center justify-center"
                              title="Subtract 1 point"
                            >
                              ▼
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => removePlayer(id, player.name)}
                            className="bg-red-500 hover:bg-red-600 text-white w-8 h-8 rounded flex items-center justify-center transition"
                            title="Remove player"
                          >
                            <span className="text-white text-lg">✕</span>
                          </button>
                          {/* Spotlight button - show during results and auction-results phases */}
                          {(state.phase === 'results' || state.phase === 'auction-results') && (
                            <button
                              onClick={() => startSpotlight(id)}
                              className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 w-8 h-8 rounded flex items-center justify-center transition font-bold"
                              title="Put in spotlight"
                            >
                              ⭐
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {/* Always show bet and answer */}
                      <div className="space-y-1 text-sm">
                        <div className="text-gray-300">
                          <span className="text-gray-500">Bet:</span> {state.answers[id]?.bet !== undefined ? `${state.answers[id].bet} pts` : 'Not submitted'}
                        </div>
                        <div className="text-gray-300">
                          <span className="text-gray-500">Answer:</span> {state.answers[id]?.answer || 'Not submitted'}
                        </div>
                        
                        {/* Show time and focus info only during/after answering */}
                        {(state.phase === 'answering' || state.phase === 'results') && state.answers[id]?.timeTaken && (
                          <div className="text-blue-300">
                            <span className="text-gray-500">⏱️ Time:</span> {state.answers[id].timeTaken}s
                          </div>
                        )}
                        {(state.phase === 'answering' || state.phase === 'results') && state.answers[id]?.focusLosses > 0 && (
                          <div className="text-yellow-300">
                            <span className="text-gray-500">⚠️ Focus lost:</span> {state.answers[id].focusLosses} time{state.answers[id].focusLosses > 1 ? 's' : ''}
                            {state.answers[id].focusLostTime && ` (${state.answers[id].focusLostTime}s away)`}
                          </div>
                        )}
                        
                        {/* Show prediction during spotlight */}
                        {state.phase === 'spotlight' && state.spotlightPlayerId !== id && state.spotlightPredictions && state.spotlightPredictions[id] && (
                          <div className="text-purple-300 font-semibold">
                            <span className="text-gray-500">Prediction:</span> {state.spotlightPredictions[id] === 'correct' ? '✓ Correct' : '✗ Wrong'}
                          </div>
                        )}
                      </div>
                      
                      {/* Grading buttons - only during answering phase */}
                      {state.phase === 'answering' && state.answers[id]?.answer && !state.answers[id]?.graded && (
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => markAnswer(id, true)}
                            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded transition font-semibold"
                          >
                            ✓ Correct
                          </button>
                          <button
                            onClick={() => markAnswer(id, false)}
                            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded transition font-semibold"
                          >
                            ✗ Wrong
                          </button>
                        </div>
                      )}
                      
                      {/* Undo button - only during answering phase when graded */}
                      {state.phase === 'answering' && state.answers[id]?.graded && (
                        <div className="mt-3">
                          <button
                            onClick={() => undoGrading(id)}
                            className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded transition font-semibold inline-block"
                          >
                            ↶ Undo Grading
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {playerList.length === 0 && (
                <div className="text-center text-gray-400 py-8">
                  No players yet. Share the player link!
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById('app'));