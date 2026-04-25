import { auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged,
  deleteUser
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

import {
  doc,
  getDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
// Elements
const usernameEl = document.getElementById("profileUsername");
const emailEl = document.getElementById("profileEmail");

const timesPlayedEl = document.getElementById("timesPlayed");
const highestScoreEl = document.getElementById("highestScore");
const averageScoreEl = document.getElementById("averageScore");
const longestStreakEl = document.getElementById("longestStreak");
const currentStreakEl = document.getElementById("currentStreak");

// Auth check + load data
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  // Basic info
  emailEl.textContent = user.email || "No email found";

  try {
    // Get user profile (username)
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const data = userSnap.data();
      usernameEl.textContent = data.username || user.email.split("@")[0];
    } else {
      usernameEl.textContent = user.email.split("@")[0];
    }

    // Get stats
    const statsRef = doc(db, "users", user.uid, "stats", "lettersIn");
    const statsSnap = await getDoc(statsRef);

    if (statsSnap.exists()) {
      const stats = statsSnap.data();

      timesPlayedEl.textContent = stats.timesPlayed || 0;
      highestScoreEl.textContent = stats.highestScore || 0;
      averageScoreEl.textContent = stats.averageScore || 0;
      longestStreakEl.textContent = stats.longestStreak || 0;
      currentStreakEl.textContent = stats.currentStreak || 0;
    }

  } catch (error) {
    console.error("Error loading profile:", error);
  }
});

window.confirmDeleteAccount = async function () {
  const confirmDelete = confirm("Are you sure you want to delete your RobTechUK account?");

  if (!confirmDelete) return;

  const user = auth.currentUser;

  if (!user) {
    alert("No user found.");
    return;
  }

  try {
    const uid = user.uid;

// 🔥 Delete Firebase Auth account first
await deleteUser(user);

// 🔥 Then delete Firestore data
await deleteDoc(doc(db, "users", uid, "stats", "lettersIn"));
await deleteDoc(doc(db, "users", uid));

    alert("Your account has been deleted.");

    // Redirect to home
    window.location.href = "index.html";

  } catch (error) {
    console.error("Delete error:", error);

    if (error.code === "auth/requires-recent-login") {
      alert("Please log out and log back in before deleting your account.");
    } else {
      alert("Error deleting account. Please try again.");
    }
  }
};
const deleteAccountBtn = document.getElementById("deleteAccountBtn");

if (deleteAccountBtn) {
  deleteAccountBtn.addEventListener("click", () => {
    window.confirmDeleteAccount();
  });
}