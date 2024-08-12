const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");


dotenv.config();

const app = express();
const port = process.env.PORT;

const genAI = new GoogleGenerativeAI(process.env.API_KEY);

app.use(bodyParser.json());
app.use(express.static("public"));

const sessions = new Map();

app.post('/submit-name', (req, res) => {

  const userName = req.body.userName;
 
  
  // Store user's name in session or database if needed
  // Redirect to bot.html or send back a response accordingly
  res.redirect('/bot.html');
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