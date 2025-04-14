// --- popup.js ---
document.addEventListener("DOMContentLoaded", () => {
    const getDataButton = document.getElementById("getData");
    const goToSummaryButton = document.getElementById("goToSummary");
    const puzzleList = document.getElementById("puzzleList");

    console.log("Popup loaded.");

    // Check current mode (scrapeMode) and update the button label
    chrome.storage.local.get({ scrapeMode: false }, (data) => {
        if (data.scrapeMode === undefined) {
            chrome.storage.local.set({ scrapeMode: false });  // Set to false by default
            console.log("Initialized scrapeMode to false.");
        }
        console.log("Current scrapeMode:", data.scrapeMode);
        getDataButton.textContent = data.scrapeMode ? "Stop Getting Data" : "Get Data";
    });

    // Toggle Get Data mode: when active, scraping mode is on.
    getDataButton.addEventListener("click", () => {
        chrome.storage.local.get({ scrapeMode: false }, (data) => {
            const newState = !data.scrapeMode;  // Toggle scrapeMode
            console.log(`Toggling mode. New scrapeMode: ${newState}`);
            chrome.storage.local.set({ scrapeMode: newState }, () => {
                getDataButton.textContent = newState ? "Stop Getting Data" : "Get Data";
                console.log(`Mode set to: ${newState ? 'scraping' : 'auto-navigation'}`);

                // Notify the active content script to update its behavior immediately
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs.length > 0) {
                        chrome.tabs.sendMessage(tabs[0].id, { action: "updateMode", scrapeMode: newState });
                    }
                });
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
        if (puzzleDate.getDay() === 6) {  // Saturday
            li.innerHTML = `<strong>Date: ${puzzle.date}, Time: ${puzzle.time}</strong>`;
        } else {
            li.textContent = `Date: ${puzzle.date}, Time: ${puzzle.time}`;
        }
        return li;
    }

    // Function to update the displayed list of saved puzzles
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
    updatePuzzleList();

    // Listen for changes in chrome storage and update the puzzle list in realtime.
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === "local" && changes.puzzles) {
            updatePuzzleList();
        }
    });
});

