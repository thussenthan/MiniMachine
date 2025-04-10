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

    // Function to update the displayed list of saved puzzles
    function updatePuzzleList() {
        chrome.storage.local.get({ puzzles: [] }, (data) => {
            puzzleList.innerHTML = "";
            if (!data.puzzles.length) {
                const li = document.createElement("li");
                li.textContent = "No puzzles saved.";
                puzzleList.appendChild(li);
            } else {
                data.puzzles.slice().reverse().forEach((puzzle) => {
                    const li = document.createElement("li");
                    li.textContent = `Date: ${puzzle.date}, Time: ${puzzle.time}`;
                    puzzleList.appendChild(li);
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

