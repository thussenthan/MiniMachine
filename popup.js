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
            chrome.storage.local.set({ mode: 0 });  // Set to auto-navigation (0) by default
        }
        getDataButton.textContent = data.mode === 1 ? "Stop Getting Data" : "Get Data";
        if (data.mode === 2) {
            SonicScraperButton.innerHTML = `<img src="icons/sonic-roll.gif" alt="SonicScraper On" style="width:25px;height:25px; vertical-align: middle;">`;
        } else {
            SonicScraperButton.innerHTML = `<img src="icons/sonic.png" alt="SonicScraper Off" style="width:25px;height:25px; vertical-align: middle;">`;
        }
    });

    // Toggle Get Data mode: when active, scraping mode is on (mode=1)
    if (getDataButton) {
        getDataButton.addEventListener("click", () => {
            chrome.storage.local.get({ mode: 0 }, (data) => {
                const newMode = data.mode === 1 ? 0 : 1;  // Toggle between 0 and 1
                console.log(`Toggling mode. New mode: ${newMode}`);
                chrome.storage.local.set({ mode: newMode }, () => {
                    getDataButton.textContent = newMode === 1 ? "Stop Getting Data" : "Get Data";
                    console.log(`Mode set to: ${newMode === 1 ? 'scraping' : 'auto-navigation'}`);

                    // Notify the active content script to update its behavior immediately
                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        if (tabs.length > 0) {
                            chrome.tabs.sendMessage(tabs[0].id, { action: "updateMode", mode: newMode });
                        }
                    });
                });
            });
        });
    }

    // Toggle SonicScraper mode: toggles between auto-navigation (0) and SonicScraper (mode=2)
    if (SonicScraperButton) {
        SonicScraperButton.addEventListener("click", () => {
            chrome.storage.local.get({ mode: 0 }, (data) => {
                const newSonicMode = data.mode === 2 ? 0 : 2;  // Toggle between 0 and 2
                console.log(`Toggling SonicScraper mode. New mode: ${newSonicMode}`);
                chrome.storage.local.set({ mode: newSonicMode }, () => {
                    if (newSonicMode === 2) {
                        // When toggled ON, open the archive in a new tab and display the gif
                        SonicScraperButton.innerHTML = `<img src="icons/sonic-roll.gif" alt="SonicScraper On" style="width:25px;height:25px; vertical-align: middle;">`;
                    } else {
                        // When toggled off, display the static image with the same fixed dimensions
                        SonicScraperButton.innerHTML = `<img src="icons/sonic.png" alt="SonicScraper Off" style="width:25px;height:25px; vertical-align: middle;">`;
                    }
                    console.log(`SonicScraper mode set to: ${newSonicMode === 2 ? 'on' : 'off'}`);
                    // Notify the active content script to update its behavior immediately
                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        if (tabs.length > 0) {
                            chrome.tabs.sendMessage(tabs[0].id, { action: "updateMode", mode: newSonicMode });
                        }
                    });
                });
            });
        });
    }

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
        if (puzzleDate.getDay() === 6) {  // Saturday
            li.innerHTML = `<strong><em>Date: ${puzzle.date}, Time: ${puzzle.time}</em></strong>`;
        } else {
            li.textContent = `Date: ${puzzle.date}, Time: ${puzzle.time}`;
        }
        return li;
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
            const startDate = new Date('2014-08-21');
            const today = new Date();
            const totalDays = Math.floor((today - startDate) / (1000 * 60 * 60 * 24)) + 1;
            const percentage = ((processed / totalDays) * 100).toFixed(1);
            const popupStats = document.getElementById("statistics");
            if (popupStats) {
                popupStats.innerText = `Processed: ${processed} / ${totalDays} (${percentage}%)`;
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
});

