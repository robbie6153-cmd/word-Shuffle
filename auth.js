import { auth, db } from "./firebase-config.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
let currentUser = null;
let currentUsername = null;

// 🔐 Auth state listener
const accountBtn = document.getElementById("accountBtn");
const loggedInBox = document.getElementById("loggedInBox");

onAuthStateChanged(auth, async (user) => {
  if (user) {
    let username = user.email;

    const userSnap = await getDoc(doc(db, "users", user.uid));
    if (userSnap.exists()) {
      username = userSnap.data().username || user.email;
    }

    if (loggedInBox) {
      loggedInBox.textContent = `Signed in as ${username}`;
    }

    if (accountBtn) {
      accountBtn.style.display = "none";
    }
  } else {
    if (loggedInBox) {
      loggedInBox.textContent = "";
    }

    if (accountBtn) {
      accountBtn.style.display = "block";
    }
  }
});

// 🆕 Sign up
window.signUp = async function () {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const username = document.getElementById("username").value.trim();

  if (!email || !password || !username) {
    alert("Please enter email, password and username.");
    return;
  }

  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const user = result.user;

    await setDoc(doc(db, "users", user.uid), {
      email: email,
      username: username,
      createdAt: serverTimestamp()
    });

    alert("Account created. You are now logged in.");
  if (localStorage.getItem("pendingLettersInScore")) {
  window.location.href = "index.html?submitPendingScore=true";
} else {
  window.location.href = "index.html";
}
  } catch (error) {
    alert(error.message);
  }
};

// 🔐 Log in
window.logIn = async function () {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    alert("Please enter email and password.");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    alert("Logged in.");
  if (localStorage.getItem("pendingLettersInScore")) {
  window.location.href = "index.html?submitPendingScore=true";
} else {
  window.location.href = "index.html";
}
  } catch (error) {
    alert(error.message);
  }
};

// 🔁 Reset password
window.forgotPassword = async function () {
  const email = document.getElementById("email").value.trim();

  if (!email) {
    alert("Enter your email first.");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    alert("Password reset email sent.");
  } catch (error) {
    alert(error.message);
  }
};

// 🚪 Log out
window.logOut = async function () {
  await signOut(auth);
  alert("Logged out.");
};

// 📅 Daily ID
function getTodayId() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

// 🏆 Submit score (daily leaderboard)
window.submitRobTechScore = async function (score) {
  if (!auth.currentUser) {
    alert("You need to create an account or log in to submit your score.");
    return;
  }

  const uid = auth.currentUser.uid;
  const todayId = getTodayId();

  try {
    // 🔍 Always fetch latest username from Firestore
    const userSnap = await getDoc(doc(db, "users", uid));

    let username = "Player";

    if (userSnap.exists()) {
      username = userSnap.data().username || "Player";
    }

 await addDoc(
  collection(
    db,
    "leaderboards",
    "letters-in",
    "days",
    todayId,
    "scores"
  ),
  {
    uid: uid,
    username: username,
    score: score,
    game: "letters-in",
    day: todayId,
    submittedAt: serverTimestamp()
  }
);

    alert("Score submitted to today's leaderboard!");
    window.location.href = "leaderboard.html";
  } catch (error) {
    alert(error.message);
  }
};