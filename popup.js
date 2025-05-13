// --- popup.js ---
document.addEventListener("DOMContentLoaded", () => {
    const getDataButton = document.getElementById("getData");
    const goToStatisticsButton = document.getElementById("goToStatistics");
    const puzzleList = document.getElementById("puzzleList");
    const SonicScraperButton = document.getElementById("SonicScraper");

    console.log("Popup loaded.");

    // Check current mode and update the button label and icon accordingly
    chrome.storage.local.get({ mode: 0 }, (data) => {
        if (data.mode === undefined) {
            chrome.storage.local.set({ mode: 0 }); // Set to auto-navigation (0) by default
        }
        getDataButton.innerHTML =
            data.mode === 1
                ? `<img src="assets/images/thinking_robot.gif" alt="Stop Getting Data">`
                : `<img src="assets/images/logo.png" alt="Get Data">`;
        getDataButton.title =
            data.mode === 1 ? "Stop Getting Data" : "Get Data";
        // Add or remove collecting class based on mode
        getDataButton.classList.toggle("collecting", data.mode === 1);

        if (data.mode === 2) {
            SonicScraperButton.innerHTML = `<img src="assets/images/sonic-rolling.gif" alt="SonicScraper On">`;
        } else {
            SonicScraperButton.innerHTML = `<img src="assets/images/sonic.png" alt="SonicScraper Off">`;
        }
        // Toggle active class for SonicScraper
        SonicScraperButton.classList.toggle("active", data.mode === 2);
    });

    // Helper: ensure content scripts are injected before messaging
    function ensureContentScript(tabId, callback) {
        chrome.scripting.executeScript(
            {
                target: { tabId: tabId },
                files: ["src/components/utils.js", "src/content.js"],
            },
            callback
        );
    }

    // Toggle Get Data (mode 1) <-> off (mode 0)
    getDataButton.addEventListener("click", () => {
        chrome.storage.local.get({ mode: 0 }, (data) => {
            const newMode = data.mode === 1 ? 0 : 1;
            chrome.storage.local.set({ mode: newMode }, () => {
                getDataButton.innerHTML =
                    newMode === 1
                        ? `<img src="assets/images/thinking_robot.gif" alt="Stop Getting Data">`
                        : `<img src="assets/images/logo.png" alt="Get Data">`;
                getDataButton.title =
                    newMode === 1 ? "Stop Getting Data" : "Get Data";
                // Toggle collecting class
                getDataButton.classList.toggle("collecting", newMode === 1);

                // always turn SonicScraper off
                SonicScraperButton.innerHTML = `<img src="assets/images/sonic.png" alt="SonicScraper Off">`;
                SonicScraperButton.classList.remove("active");
                // notify content
                chrome.tabs.query(
                    { active: true, currentWindow: true },
                    (tabs) => {
                        if (tabs[0]) {
                            ensureContentScript(tabs[0].id, () => {
                                chrome.tabs.sendMessage(
                                    tabs[0].id,
                                    {
                                        action: "updateMode",
                                        mode: newMode,
                                    },
                                    (response) => {
                                        if (chrome.runtime.lastError) {
                                            console.warn(
                                                "Could not send updateMode message:",
                                                chrome.runtime.lastError.message
                                            );
                                        }
                                    }
                                );
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
                    SonicScraperButton.innerHTML = `<img src="assets/images/sonic-rolling.gif" alt="SonicScraper On">`;
                } else {
                    SonicScraperButton.innerHTML = `<img src="assets/images/sonic.png" alt="SonicScraper Off">`;
                }
                // Toggle active class for SonicScraper
                SonicScraperButton.classList.toggle("active", newMode === 2);
                // always turn Get Data off
                getDataButton.innerHTML = `<img src="assets/images/logo.png" alt="Get Data">`;
                getDataButton.title = "Get Data";
                // Ensure collecting class removed when not collecting
                getDataButton.classList.remove("collecting");
                chrome.tabs.query(
                    { active: true, currentWindow: true },
                    (tabs) => {
                        if (tabs[0]) {
                            ensureContentScript(tabs[0].id, () => {
                                chrome.tabs.sendMessage(
                                    tabs[0].id,
                                    {
                                        action: "updateMode",
                                        mode: newMode,
                                    },
                                    (response) => {
                                        if (chrome.runtime.lastError) {
                                            console.warn(
                                                "Could not send updateMode message:",
                                                chrome.runtime.lastError.message
                                            );
                                        }
                                    }
                                );
                            });
                        }
                    }
                );
            });
        });
    });

    // Go to Statistics page: Open the stats page in a new tab
    goToStatisticsButton.addEventListener("click", () => {
        chrome.tabs.create({ url: chrome.runtime.getURL("statistics.html") });
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
            // Saturday: add accent class
            li.classList.add("saturday");
            li.innerHTML = `<strong>Date: ${puzzle.date}, Time: ${puzzle.time}</strong>`;
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
            const startDate = new Date("2014-08-21");
            const today = getPublishedPuzzleDate();
            const totalDays =
                Math.floor((today - startDate) / (1000 * 60 * 60 * 24)) + 1;
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

    // Wire up the button to go to most recent unsolved puzzle
    const goBtn = document.getElementById("goToLatestNull");
    // Only show "Latest Unsolved" when on NYT Mini crossword pages
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const url = tabs[0]?.url || "";
        if (
            goBtn &&
            !/^https:\/\/www\.nytimes\.com\/crosswords\/game\/mini/.test(url)
        ) {
            goBtn.style.display = "none";
        }
    });
    if (goBtn) {
        goBtn.addEventListener("click", () => {
            // Navigate to nearest unsolved crossword starting from today
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    ensureContentScript(tabs[0].id, () => {
                        chrome.tabs.sendMessage(
                            tabs[0].id,
                            {
                                action: "navigateCrossword",
                            },
                            (response) => {
                                if (chrome.runtime.lastError) {
                                    console.warn(
                                        "Could not send navigateCrossword message:",
                                        chrome.runtime.lastError.message
                                    );
                                }
                            }
                        );
                    });
                }
            });
        });
    }

    // Show navigation button when popup opens
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            ensureContentScript(tabs[0].id, () => {
                chrome.tabs.sendMessage(
                    tabs[0].id,
                    { action: "showNavButton" },
                    (response) => {
                        if (chrome.runtime.lastError) {
                            console.warn(
                                "Could not send showNavButton message:",
                                chrome.runtime.lastError.message
                            );
                        }
                    }
                );
            });
        }
    });
});
