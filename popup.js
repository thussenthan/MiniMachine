// --- popup.js ---
document.addEventListener("DOMContentLoaded", () => {
    const getDataButton = document.getElementById("getData");
    const goToSummaryButton = document.getElementById("goToSummary");
    const puzzleList = document.getElementById("puzzleList");
    const SonicScraperButton = document.getElementById("SonicScraper");

    console.log("Popup loaded.");

    // Check current mode and update the button label and icon accordingly
    chrome.storage.local.get({ mode: 0 }, (data) => {
        if (data.mode === undefined) {
            chrome.storage.local.set({ mode: 0 }); // Set to auto-navigation (0) by default
        }
        getDataButton.textContent =
            data.mode === 1 ? "Stop Getting Data" : "Get Data";
        if (data.mode === 2) {
            SonicScraperButton.innerHTML = `<img src="icons/sonic-roll.gif" alt="SonicScraper On" style="width:25px;height:25px; vertical-align: middle;">`;
        } else {
            SonicScraperButton.innerHTML = `<img src="icons/sonic.png" alt="SonicScraper Off" style="width:25px;height:25px; vertical-align: middle;">`;
        }
    });

    // Toggle Get Data (mode 1) <-> off (mode 0)
    getDataButton.addEventListener("click", () => {
        chrome.storage.local.get({ mode: 0 }, (data) => {
            const newMode = data.mode === 1 ? 0 : 1;
            chrome.storage.local.set({ mode: newMode }, () => {
                getDataButton.textContent =
                    newMode === 1 ? "Stop Getting Data" : "Get Data";
                // always turn SonicScraper off
                SonicScraperButton.innerHTML = `<img src="icons/sonic.png" alt="SonicScraper Off" style="width:25px;height:25px; vertical-align: middle;">`;
                // notify content
                chrome.tabs.query(
                    { active: true, currentWindow: true },
                    (tabs) => {
                        if (tabs[0]) {
                            chrome.tabs.sendMessage(tabs[0].id, {
                                action: "updateMode",
                                mode: newMode,
                            });
                        }
                    }
                );
            });
        });
    });

    // Toggle SonicScraper (mode 2) <-> off (mode 0)
    SonicScraperButton.addEventListener("click", () => {
        chrome.storage.local.get({ mode: 0 }, (data) => {
            const newMode = data.mode === 2 ? 0 : 2;
            chrome.storage.local.set({ mode: newMode }, () => {
                if (newMode === 2) {
                    SonicScraperButton.innerHTML = `<img src="icons/sonic-rolling.gif" alt="SonicScraper On" style="width:25px;height:25px; vertical-align: middle;">`;
                } else {
                    SonicScraperButton.innerHTML = `<img src="icons/sonic.png" alt="SonicScraper Off" style="width:25px;height:25px; vertical-align: middle;">`;
                }
                // always turn Get Data off
                getDataButton.textContent = "Get Data";
                chrome.tabs.query(
                    { active: true, currentWindow: true },
                    (tabs) => {
                        if (tabs[0]) {
                            chrome.tabs.sendMessage(tabs[0].id, {
                                action: "updateMode",
                                mode: newMode,
                            });
                        }
                    }
                );
            });
        });
    });

    // Go to Summary page: Open the summary page in a new tab
    goToSummaryButton.addEventListener("click", () => {
        chrome.tabs.create({ url: chrome.runtime.getURL("summary.html") });
    });

    // Helper: Convert "m:ss" to seconds.
    function timeToSeconds(timeString) {
        if (!timeString) return null;
        const parts = timeString.split(":");
        if (parts.length !== 2) return null;
        const minutes = parseInt(parts[0].trim(), 10);
        const seconds = parseInt(parts[1].trim(), 10);
        return minutes * 60 + seconds;
    }

    // Helper: Create a list item for a puzzle, bolding it if the date is a Saturday.
    function createPuzzleListItem(puzzle) {
        const li = document.createElement("li");
        const puzzleDate = new Date(puzzle.date);
        if (puzzleDate.getDay() === 6) {
            // Saturday
            li.innerHTML = `<strong><em>Date: ${puzzle.date}, Time: ${puzzle.time}</em></strong>`;
        } else {
            li.textContent = `Date: ${puzzle.date}, Time: ${puzzle.time}`;
        }
        return li;
    }

    // Helper: Find the most recent date (MM/DD/YYYY) with no recorded time.
    function getLatestUnsolvedDate(puzzles) {
        const startDate = new Date("2014-08-21");
        const today = new Date();
        let d = new Date(today);
        d.setHours(0, 0, 0, 0);
        while (d >= startDate) {
            const dateStr = `${
                d.getMonth() + 1
            }/${d.getDate()}/${d.getFullYear()}`;
            const entry = puzzles.find((p) => p.date === dateStr);
            if (!entry || !entry.time || entry.time.trim() === "") {
                return dateStr;
            }
            d.setDate(d.getDate() - 1);
        }
        // Fallback: today's date if none found
        return `${
            today.getMonth() + 1
        }/${today.getDate()}/${today.getFullYear()}`;
    }

    // Function to update the displayed list of puzzles in storage
    function updatePuzzleList() {
        chrome.storage.local.get({ puzzles: [] }, (data) => {
            puzzleList.innerHTML = "";
            const puzzles = data.puzzles;
            if (!puzzles.length) {
                const li = document.createElement("li");
                li.textContent = "No puzzles saved.";
                puzzleList.appendChild(li);
            } else {
                // Sort puzzles sequentially:
                // First by date (newest first) then by solving time (in seconds).
                puzzles.sort((a, b) => {
                    const dateA = new Date(a.date);
                    const dateB = new Date(b.date);
                    if (dateB - dateA !== 0) {
                        return dateB - dateA;
                    }
                    const aTime = timeToSeconds(a.time);
                    const bTime = timeToSeconds(b.time);
                    if (aTime === null && bTime === null) return 0;
                    if (aTime === null) return 1;
                    if (bTime === null) return -1;
                    return aTime - bTime;
                });
                puzzles.forEach((puzzle) => {
                    puzzleList.appendChild(createPuzzleListItem(puzzle));
                });
            }
        });
    }

    // Function to update the statistics section
    function updateStatistics() {
        chrome.storage.local.get({ puzzles: [] }, (result) => {
            const puzzles = result.puzzles;
            const processed = puzzles.length;
            const startDate = new Date("2014-08-21");
            const today = new Date();
            const totalDays =
                Math.floor((today - startDate) / (1000 * 60 * 60 * 24)) + 1;
            const percentage = ((processed / totalDays) * 100).toFixed(1);

            const popupStats = document.getElementById("statistics");
            if (popupStats) {
                popupStats.innerText = `Processed: ${processed} / ${totalDays} (${percentage}%)`;
            }

            // Update button label
            const goBtn = document.getElementById("goToLatestNull");
            if (goBtn) {
                const latest = getLatestUnsolvedDate(puzzles);
                goBtn.textContent = `Go to latest unsolved: ${latest}`;
            }
        });
    }

    updatePuzzleList();
    updateStatistics();

    // Listen for changes in chrome storage and update the puzzle list and statistics in realtime.
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === "local" && changes.puzzles) {
            updatePuzzleList();
            updateStatistics();
        }
    });

    // Wire up the button to go to most recent unsolved puzzle
    const goBtn = document.getElementById("goToLatestNull");
    if (goBtn) {
        goBtn.addEventListener("click", () => {
            chrome.storage.local.get({ puzzles: [] }, (result) => {
                const puzzles = result.puzzles;
                const targetDate = getLatestUnsolvedDate(puzzles);
                const [m, d, y] = targetDate.split("/");
                const mm = String(m).padStart(2, "0");
                const dd = String(d).padStart(2, "0");
                const url = `https://www.nytimes.com/crosswords/game/mini/${y}/${mm}/${dd}`;
                window.open(url, "_blank");
            });
        });
    }
});
