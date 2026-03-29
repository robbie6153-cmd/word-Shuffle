let dictionary = [];

function getDictionaryArray() {
  return dictionary;
}

fetch("https://cdn.jsdelivr.net/npm/an-array-of-english-words/index.json")
  .then(response => response.json())
  .then(words => {
    dictionary = words.map(word => word.trim().toUpperCase());
    console.log("Dictionary loaded:", dictionary.length, "words");
  })
  .catch(error => {
    console.error("Error loading dictionary:", error);
  });