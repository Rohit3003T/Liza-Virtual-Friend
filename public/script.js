let recognition;
let isListening = false;
let isVoiceOutputEnabled = true;
let speechSynthesis = window.speechSynthesis;
let maleVoice;
let speechQueue = [];
let voicesLoaded = false;
let userId;

document.addEventListener("DOMContentLoaded", () => {
  recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition || window.msSpeechRecognition)();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  document.getElementById("voice-button").addEventListener("click", () => {
    if (!isListening) {
      startListening();
    } else {
      stopListening();
      sendMessage();
    }
  });

  recognition.onresult = (event) => {
    const last = event.results.length - 1;
    const text = event.results[last][0].transcript;
    document.getElementById("user-input").value = text;
  };

  document.getElementById("user-input").addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      sendMessage();
    }
  });

  document.getElementById("send-button").addEventListener("click", sendMessage);

  document.getElementById("voice-output-button").addEventListener("click", toggleVoiceOutput);

  speechSynthesis.onvoiceschanged = () => {
    const voices = speechSynthesis.getVoices();
    maleVoice = voices.find(voice => voice.name.includes('male') || voice.name.includes('man'));
    if (!maleVoice) {
      maleVoice = voices.find(voice => voice.lang.startsWith('en'));
    }
    voicesLoaded = true;
  };

  updateVoiceOutputButton();
  loadChatHistory();
  setInterval(askEngagingQuestion, 5 * 60 * 1000);
});

async function loadChatHistory() {
  userId = localStorage.getItem('userId');
  if (!userId) {
    console.error('User ID not found');
    return;
  }

  try {
    const response = await fetch(`/chat-history?userId=${userId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch chat history');
    }
    const chatHistory = await response.json();
    chatHistory.forEach(message => {
      addMessage(message.message, message.sender.toLowerCase());
    });
    if (chatHistory.length === 0) {
      greetUser();
    }
  } catch (error) {
    console.error('Error loading chat history:', error);
    greetUser();
  }
}

function greetUser() {
  if (!voicesLoaded) return;

  const greetings = [
    "Hello! I'm Liza, your AIFriend. How are you feeling today?",
    "Hi there! I'm Liza, your AIFriend. What's on your mind?",
    "Welcome! I'm Liza, your AIFriend. How can I support you today?",
    "Greetings! I'm Liza, your AIFriend. How has your day been so far?",
    "Hi! I'm Liza, your AIFriend. Is there anything you'd like to talk about?"
  ];
  const greeting = greetings[Math.floor(Math.random() * greetings.length)];
  addMessage(greeting, "bot");
  speakText(greeting);
}

async function sendMessage() {
  const userInput = document.getElementById("user-input").value;
  if (userInput.trim() === "") return;

  addMessage(userInput, "user");
  document.getElementById("user-input").value = "";

  try {
    const response = await fetch("/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        prompt: userInput,
        userId: userId
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch response");
    }

    const data = await response.json();
    addMessage(data.text, "bot");
    if (isVoiceOutputEnabled && data.text) {
      speakText(data.text);
    }
  } catch (error) {
    addMessage("Error: " + error.message, "bot");
  }
}

function addMessage(text, sender) {
  const messageElement = document.createElement("div");
  messageElement.classList.add("message", sender, "border");
  messageElement.textContent = text;
  document.getElementById("chat-box").appendChild(messageElement);
  messageElement.scrollIntoView();
}

function startListening() {
  recognition.start();
  isListening = true;
  document.getElementById("voice-button").classList.add("listening");
  console.log("Voice recognition started");
}

function stopListening() {
  recognition.stop();
  isListening = false;
  document.getElementById("voice-button").classList.remove("listening");
  console.log("Voice recognition stopped");
}

function toggleVoiceOutput() {
  isVoiceOutputEnabled = !isVoiceOutputEnabled;
  updateVoiceOutputButton();
}

function updateVoiceOutputButton() {
  const voiceOutputButton = document.getElementById("voice-output-button");
  voiceOutputButton.innerHTML = `<i class="fas fa-volume-${isVoiceOutputEnabled ? 'up' : 'mute'} mr-1"></i>Voice Output: ${isVoiceOutputEnabled ? "On" : "Off"}`;
  voiceOutputButton.classList.toggle("btn-outline-light", isVoiceOutputEnabled);
  voiceOutputButton.classList.toggle("btn-outline-secondary", !isVoiceOutputEnabled);
}

function speakText(text) {
  if (!voicesLoaded) {
    setTimeout(() => speakText(text), 100);
    return;
  }

  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
  }
  speechQueue = [];

  let cleanedText = text
    .replace(/\*/g, '')
    .replace(/[\_\#\~\`\-]/g, ' ')
    .replace(/\n/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();

  cleanedText = cleanedText.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
  cleanedText = cleanedText.replace(/<[^>]*>/g, '');

  const sentences = cleanedText.match(/[^!?]+[.!?]+|\S+/g) || [];

  let chunk = '';
  sentences.forEach((sentence) => {
    if (chunk.length + sentence.length < 100) {
      chunk += sentence + ' ';
    } else {
      speechQueue.push(chunk.trim());
      chunk = sentence + ' ';
    }
  });
  if (chunk) {
    speechQueue.push(chunk.trim());
  }

  speakNextInQueue();
}

function speakNextInQueue() {
  if (speechQueue.length === 0) return;

  const textToSpeak = speechQueue.shift();
  const utterance = new SpeechSynthesisUtterance(textToSpeak);
  utterance.lang = "en-US";

  if (maleVoice) {
    utterance.voice = maleVoice;
  }

  utterance.pitch = 1;
  utterance.rate = 0.9;

  utterance.onend = () => {
    speakNextInQueue();
  };

  speechSynthesis.speak(utterance);
}

function askEngagingQuestion() {
  const questions = [
    "How are you feeling right now?",
    "What's been on your mind lately?",
    "Is there anything you'd like to talk about?",
    "Have you experienced any challenges recently?",
    "What's something positive that happened to you lately?",
    "How have you been taking care of yourself?",
    "Is there a goal you're working towards?",
    "What's something you're looking forward to?"
  ];
  const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
  addMessage(randomQuestion, "bot");
  speakText(randomQuestion);
}

window.addEventListener('beforeunload', () => {
  speechSynthesis.cancel();
});