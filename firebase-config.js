// Firebase setup
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

// Your config
const firebaseConfig = {
  apiKey: "AIzaSyDjRUGGgHuIvqZn8F1Z83zry_kDg8Vf3SE",
  authDomain: "robtechuk-games.firebaseapp.com",
  projectId: "robtechuk-games",
  storageBucket: "robtechuk-games.firebasestorage.app",
  messagingSenderId: "779242786815",
  appId: "1:779242786815:web:129205bf776d09b5ae21ca",
  measurementId: "G-9T3P7N8RXH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Services
export const auth = getAuth(app);
export const db = getFirestore(app);

// 👇 MAKE AVAILABLE TO game.js (VERY IMPORTANT)
window.auth = auth;
window.db = db;
window.doc = doc;
window.getDoc = getDoc;
window.setDoc = setDoc;