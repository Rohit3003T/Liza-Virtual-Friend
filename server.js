const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const { Pool } = require("pg");

dotenv.config();

const app = express();
const port = process.env.PORT;

const genAI = new GoogleGenerativeAI(process.env.API_KEY);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// Database setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create tables if they don't exist
pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    message TEXT NOT NULL,
    sender VARCHAR(10) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`).catch(err => console.error('Error creating tables:', err));

app.post('/submit-name', async (req, res) => {
  const userName = req.body.userName;

  try {
    const result = await pool.query('INSERT INTO users (name) VALUES ($1) RETURNING id', [userName]);
    const userId = result.rows[0].id;
    
    res.json({ userId: userId });
  } catch (error) {
    console.error('Error storing user name:', error);
    res.status(500).send('Error storing user name');
  }
});

app.post("/generate", async (req, res) => {
  const { prompt, userId } = req.body;

  try {
    // Store user's message
    await pool.query('INSERT INTO chat_history (user_id, message, sender) VALUES ($1, $2, $3)', 
      [userId, prompt, 'Human']);

    // Fetch chat history
    const historyResult = await pool.query('SELECT message, sender FROM chat_history WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 10', [userId]);
    let history = historyResult.rows.reverse().map(row => `${row.sender}: ${row.message}`);

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const fullPrompt = `
      You are AIFriend, a friendly and empathetic AI assistant, like a supportive friend or therapist. 
      Respond in a warm, caring manner. Show genuine interest in the user's feelings and experiences.
      Ask follow-up questions to demonstrate active listening and encourage the user to share more.
      Offer gentle encouragement and validation. Avoid giving direct advice unless explicitly asked.
      If the user seems distressed, provide supportive statements and suggest professional help if appropriate.
      From today, your name is Liza.
      
      Previous conversation:
      ${history.join('\n')}
      Human: ${prompt}
      AIFriend:`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const aiResponse = response.text();

    // Store AI's response
    await pool.query('INSERT INTO chat_history (user_id, message, sender) VALUES ($1, $2, $3)', 
      [userId, aiResponse, 'AIFriend']);

    res.json({ text: aiResponse });
  } catch (error) {
    res.status(500).send("Error generating content: " + error.message);
  }
});

app.get("/chat-history", async (req, res) => {
  const userId = req.query.userId;

  try {
    const result = await pool.query('SELECT message, sender FROM chat_history WHERE user_id = $1 ORDER BY timestamp', [userId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).send('Error fetching chat history');
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});