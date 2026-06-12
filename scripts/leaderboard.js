import { serverURL as server } from "./config.js";
import { emitWithAck, attachConnectionBanner } from "./connection.js";

// NOTE: like hub.js, this page must NOT clear localStorage — players browse
// here from the hub while a Catan seat may still be live.

const socket = io(server, {
  withCredentials: true
});
attachConnectionBanner(socket);

const status = document.getElementById("lb-status");
const boards = document.querySelector(".lb-boards");

// Usernames are user input — rows are built with textContent only.
function renderRows(tbody, rows, toCells, emptyText) {
  tbody.textContent = "";
  if (!rows.length) {
    const tr = document.createElement("tr");
    tr.className = "lb-empty";
    const td = document.createElement("td");
    td.colSpan = 5;
    td.textContent = emptyText;
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  rows.forEach((row, i) => {
    const tr = document.createElement("tr");
    const rank = document.createElement("td");
    rank.className = "lb-rank";
    rank.textContent = String(i + 1);
    tr.appendChild(rank);
    toCells(row).forEach((text, col) => {
      const td = document.createElement("td");
      if (col === 0) td.className = "lb-name";
      td.textContent = text;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

async function load() {
  try {
    const res = await emitWithAck(socket, "getLeaderboards", {});
    if (!res || !res.success) throw new Error("server error");
    renderRows(
      document.getElementById("lb-geo-rows"),
      res.geo,
      r => [r.name, String(r.avg), String(r.best), String(r.rounds)],
      "No ranked players yet."
    );
    renderRows(
      document.getElementById("lb-catan-rows"),
      res.catan,
      r => [r.name, String(r.wins), String(r.games), `${r.winRate}%`],
      "No finished games yet."
    );
    document.getElementById("lb-geo-hint").textContent =
      `Play at least ${res.minRounds} rounds while signed in to get ranked.`;
    status.hidden = true;
    boards.hidden = false;
  } catch (e) {
    status.textContent = "Couldn't load the leaderboards — please try again.";
  }
}

load();
