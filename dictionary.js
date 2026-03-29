// dictionary.js — loads a full English word list

let dictionary = [];

// Load the word list
fetch("https://cdn.jsdelivr.net/npm/an-array-of-english-words/index.json")
  .then(response => response.json())
  .then(words => {
    // Convert all words to uppercase for easy matching
    dictionary = words.map(word => word.trim().toUpperCase());

    console.log("Dictionary loaded:", dictionary.length, "words");
  })
  .catch(error => {
    console.error("Error loading dictionary:", error);
  });