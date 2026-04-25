import { db } from "./firebase-config.js";

import {
  collection,
  query,
  orderBy,
  limit,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const leaderboardList = document.getElementById("leaderboardList");

function getTodayId() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

async function loadLeaderboard() {
  if (!leaderboardList) {
    console.error("leaderboardList not found");
    return;
  }

  try {
    const todayId = getTodayId();

    const scoresRef = collection(
      db,
      "leaderboards",
     "word-shuffle",
      "days",
      todayId,
      "scores"
    );

    const q = query(
      scoresRef,
      orderBy("score", "desc"),
      limit(20)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      leaderboardList.innerHTML = "<p>No scores submitted yet.</p>";
      return;
    }

    let html = "<ol>";

    snapshot.forEach((doc) => {
      const data = doc.data();
      html += `<li><strong>${data.username || "Player"}</strong> — ${data.score}</li>`;
    });

    html += "</ol>";
    leaderboardList.innerHTML = html;

  } catch (error) {
    leaderboardList.innerHTML = `<p>Error loading leaderboard: ${error.message}</p>`;
  }
}

loadLeaderboard();