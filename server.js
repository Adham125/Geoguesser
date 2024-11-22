// server.js
const express = require('express');
const game = require('./game');

const app = express();
const router = express.Router();
const PORT = 3000;

router.post('/login', async (req, res) => {
    
});

// Simple route for testing
app.get('/', (req, res) => {
  res.send('Welcome to the Hide and Seek GeoGuessr Game!');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

app.post('/start-game', (req, res) => {
    // Logic to create a new game session
    res.json({ message: 'Game started!', gameId: '12345' });
  });
  
// Route to submit a guess
app.post('/submit-guess', (req, res) => {
const { gameId, guessLat, guessLng } = req.body;
// Logic to process the guess and calculate distance
res.json({ message: 'Guess received!', distance: '5km' });
});

// Route to get game results
app.get('/results/:gameId', (req, res) => {
const gameId = req.params.gameId;
// Logic to retrieve game results
res.json({ message: `Results for game ${gameId}`, score: '100' });
});

app.use(cors())
app.use(express.json())
app.use('/users', router)