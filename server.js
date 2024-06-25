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

const sessions = new Map();

// Database setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.post('/submit-name', async (req, res) => {
  const userName = req.body.userName;

  try {
    // Store user's name in the database
    const result = await pool.query('INSERT INTO users (name) VALUES ($1) RETURNING id', [userName]);
    const userId = result.rows[0].id;
    
    // Redirect to bot.html or send back a response accordingly
    res.redirect('/bot.html');
  } catch (error) {
    console.error('Error storing user name:', error);
    res.status(500).send('Error storing user name');
  }
});

app.post("/generate", async (req, res) => {
  const { prompt, sessionId } = req.body;
  let history = sessions.get(sessionId) || [];

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const fullPrompt = `
      You are AIFriend, a friendly and empathetic AI assistant, like a supportive friend or therapist. 
      Respond in a warm, caring manner. Show genuine interest in the user's feelings and experiences.
      Ask follow-up questions to demonstrate active listening and encourage the user to share more.
      Offer gentle encouragement and validation. Avoid giving direct advice unless explicitly asked.
      If the user seems distressed, provide supportive statements and suggest professional help if appropriate.
      from today your name liza.
      
      
      Previous conversation:
      ${history.join('\n')}
      Human: ${prompt}
      AIFriend:`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const aiResponse = response.text();

    history.push(`Human: ${prompt}`);
    history.push(`AIFriend: ${aiResponse}`);
    if (history.length > 10) history = history.slice(-10);
    sessions.set(sessionId, history);

    res.json({ text: aiResponse });
  } catch (error) {
    res.status(500).send("Error generating content: " + error.message);
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
