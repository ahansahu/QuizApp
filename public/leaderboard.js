const { useState, useEffect } = React;

const API_URL = window.location.origin;

function App() {
  const [data, setData] = useState(null);
  const [prevScores, setPrevScores] = useState({});

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch(`${API_URL}/api/leaderboard`);
      const newData = await res.json();
      
      // Track which players' scores changed
      const newScores = {};
      newData.players.forEach(player => {
        newScores[player.id] = player.points;
      });
      
      setData(newData);
      
      // Update previous scores after a delay to show animation
      setTimeout(() => {
        setPrevScores(newScores);
      }, 1000);
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 1000); // Update every second
    return () => clearInterval(interval);
  }, []);

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-white text-3xl font-bold">Loading...</div>
      </div>
    );
  }

  if (data.players.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-2xl w-full text-center">
          <div className="text-8xl mb-6">🏆</div>
          <h1 className="text-5xl font-bold text-gray-800 mb-4">Live Leaderboard</h1>
          <p className="text-xl text-gray-600">Waiting for players to join...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-6 md:p-10">
          <div className="text-center mb-8">
            <div className="text-7xl mb-4">🏆</div>
            <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-yellow-500 via-purple-500 to-pink-500 bg-clip-text text-transparent mb-3">
              Live Leaderboard
            </h1>
            {data.phase !== 'registration' && (
              <p className="text-xl text-gray-600">Round {data.currentRound}</p>
            )}
          </div>

          <div className="space-y-3">
            {data.players.map((player, index) => {
              const rank = index + 1;
              const scoreChanged = prevScores[player.id] !== undefined && prevScores[player.id] !== player.points;
              const scoreIncreased = prevScores[player.id] < player.points;
              
              let medal = '';
              let bgGradient = 'bg-gradient-to-r from-gray-700 to-gray-600';
              let borderColor = 'border-gray-600';
              let rankSize = 'text-xl';
              let nameSize = 'text-base md:text-lg';
              let pointsSize = 'text-2xl md:text-3xl';
              
              if (rank === 1) {
                medal = '🥇';
                bgGradient = 'bg-gradient-to-r from-yellow-600 via-yellow-500 to-yellow-600';
                borderColor = 'border-yellow-400';
                rankSize = 'text-3xl';
                nameSize = 'text-lg md:text-xl';
                pointsSize = 'text-3xl md:text-4xl';
              } else if (rank === 2) {
                medal = '🥈';
                bgGradient = 'bg-gradient-to-r from-gray-600 to-gray-500';
                borderColor = 'border-gray-500';
                rankSize = 'text-2xl';
                nameSize = 'text-base md:text-lg';
                pointsSize = 'text-2xl md:text-3xl';
              } else if (rank === 3) {
                medal = '🥉';
                bgGradient = 'bg-gradient-to-r from-orange-900 to-orange-800';
                borderColor = 'border-orange-600';
                rankSize = 'text-2xl';
                nameSize = 'text-base md:text-lg';
                pointsSize = 'text-2xl md:text-3xl';
              }

              return (
                <div
                  key={player.id}
                  className={`${bgGradient} border-2 ${borderColor} rounded-xl p-3 md:p-4 transition-all duration-500 transform ${
                    scoreChanged ? 'scale-105 shadow-2xl' : 'hover:scale-102'
                  } ${rank === 1 ? 'shadow-xl' : 'shadow-lg'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 md:gap-4 flex-1">
                      <div className={`${rankSize} font-bold ${rank <= 3 ? '' : 'text-gray-400'} w-8 md:w-12 text-center`}>
                        {medal || `#${rank}`}
                      </div>
                      <div className="flex-1">
                        <div className={`${nameSize} font-bold text-white truncate`}>
                          {player.name}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`${pointsSize} font-bold text-blue-400 relative`}>
                        {player.points}
                        {scoreChanged && (
                          <span className={`absolute -top-4 right-0 text-xs font-semibold ${
                            scoreIncreased ? 'text-green-400' : 'text-red-400'
                          } animate-bounce`}>
                            {scoreIncreased ? '▲' : '▼'}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 font-medium">pts</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-900 border border-green-700 rounded-full">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm font-semibold text-green-300">Live Updates</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById('app'));