// --- content.js ---
// Utility: wait for an element's text (optional, used in scraping mode)
function waitForTimerElement(selector, maxWait = 1500) {
    return new Promise((resolve) => {
        const intervalTime = 100; // check every 1ms
        let timeElapsed = 0;
        const interval = setInterval(() => {
            const element = document.querySelector(selector);
            if (element && element.innerText.trim() !== "0:00") {
                clearInterval(interval);
                resolve(element.innerText.trim()); // Resolve with the timer value
            }
            timeElapsed += intervalTime;
            if (timeElapsed >= maxWait) {
                clearInterval(interval);
                resolve(null); // Resolve with `null` if nothing is found
            }
        }, intervalTime);
    });
}

// Helper: Remove any existing navigation button
function removeNavButton() {
    const existingBtn = document.getElementById("navBtn");
    if (existingBtn) {
        existingBtn.remove();
    }
}

let navObserver; // track the auto-nav observer

function resetModes() {
    removeNavButton();
    if (navObserver) {
        navObserver.disconnect();
        navObserver = null;
    }
    // any other cleanup (timers, intervals) can go here
}

// State 0: Auto-navigation functionality.
function initAutoNavigation() {
    resetModes();
    // Only show navigation button on NYT Mini crossword pages
    if (!/^https:\/\/www\.nytimes\.com\/crosswords\/game\/mini(?:$|\/)/.test(window.location.href)) {
        return;
    }

    // Extract the date from the URL (YYYY/MM/DD)
    const url = window.location.href;
    const datePattern = /(\d{4})\/(\d{2})\/(\d{2})/;
    const dateMatch = url.match(datePattern);
    let currentDate;
    let isBaseUrl = false;
    if (dateMatch) {
        currentDate = new Date(
            `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
        );
    } else {
        // Treat base URL (no date) as today's puzzle
        currentDate = getPublishedPuzzleDate();
        isBaseUrl = true;
    }

    // Create a navigation button and attach it to the page
    const button = document.createElement("button");
    button.id = "navBtn";
    button.textContent = "Next Puzzle";
    button.style.position = "fixed";
    button.style.top = "10px";
    button.style.right = "10px";
    button.style.padding = "10px 20px";
    button.style.backgroundColor = "#000";
    button.style.color = "#fff";
    button.style.border = "none";
    button.style.borderRadius = "5px";
    button.style.cursor = "pointer";
    button.style.zIndex = "9999";

    const closeBtn = document.createElement("span");
    closeBtn.textContent = "×";
    // style the close icon
    closeBtn.style.position = "absolute";
    closeBtn.style.top = "0";
    closeBtn.style.right = "0";
    closeBtn.style.transform = "translate(50%, -50%)";
    closeBtn.style.width = "16px";
    closeBtn.style.height = "16px";
    closeBtn.style.lineHeight = "16px";
    closeBtn.style.textAlign = "center";
    closeBtn.style.padding = "0";
    closeBtn.style.borderRadius = "50%";
    closeBtn.style.backgroundColor = "rgba(0, 0, 0, 0.6)";
    closeBtn.style.color = "#fff";
    closeBtn.style.fontSize = "12px";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.display = "none";
    closeBtn.style.zIndex = "10000";
    // ensure button container can show overflow
    button.style.position = "fixed";
    button.style.overflow = "visible";
    button.appendChild(closeBtn);
    button.addEventListener("mouseover", () => {
        closeBtn.style.display = "block";
    });
    button.addEventListener("mouseout", () => {
        closeBtn.style.display = "none";
    });
    closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        button.style.display = "none";
    });

    chrome.storage.local.get({ puzzles: [] }, (data) => {
        const puzzles = data.puzzles;
        // Use shared helper to find the latest unsolved puzzle date
        const latest = getLatestUnsolvedFromDate(puzzles, currentDate);
        const [m, d, y] = latest.split("/");
        const mm = String(m).padStart(2, "0");
        const dd = String(d).padStart(2, "0");
        const targetStr = `${y}/${mm}/${dd}`;
        // Navigate to the computed last unsolved puzzle URL
        let prevUrl;
        if (isBaseUrl) {
            prevUrl = `https://www.nytimes.com/crosswords/game/mini/${targetStr}`;
        } else {
            prevUrl = url.replace(datePattern, targetStr);
        }
        // set up click handler to navigate immediately to nearest unsolved
        button.addEventListener("click", () => {
            chrome.storage.local.get({ puzzles: [] }, (data) => {
                const puzzles = data.puzzles;
                const url = window.location.href;
                const datePattern = /(\d{4})\/(\d{2})\/(\d{2})/;
                const match = url.match(datePattern);
                const pageDate = match
                    ? new Date(
                          parseInt(match[1], 10),
                          parseInt(match[2], 10) - 1,
                          parseInt(match[3], 10)
                      )
                    : getPublishedPuzzleDate();
                const currentDateStr = `${
                    pageDate.getMonth() + 1
                }/${pageDate.getDate()}/${pageDate.getFullYear()}`;
                const searchDate = new Date(pageDate);
                searchDate.setDate(searchDate.getDate() - 1);
                let nextDateStr = getLatestUnsolvedFromDate(
                    puzzles,
                    searchDate
                );
                if (nextDateStr === currentDateStr) {
                    handleFallbackNavigation(pageDate, url, datePattern, false);
                    return;
                }
                // Proceed with normal navigation logic
                chrome.storage.local.set({ autoNavActive: true }, () => {
                    startAutoNavigationLoop();
                });
            });
        });
        document.body.appendChild(button);
        console.log("Navigation button added.");
    });
}

// State 1: Scraping mode (gathers data without auto-navigation)
function runScrape() {
    resetModes();
    console.log("Scrape mode active. Gathering puzzle data.");

    // Extract date parts from URL.
    const urlParts = window.location.pathname.split("/");
    if (urlParts.length < 7) {
        console.error("Unexpected URL structure; cannot extract date.");
        return;
    }
    const year = urlParts[4];
    const month = parseInt(urlParts[5], 10); // Converts "03" to 3
    const day = parseInt(urlParts[6], 10); // Converts "07" to 7
    const currentDate = `${month}/${day}/${year}`;

    waitForTimerElement(
        'button[aria-label="Timer Play Button"] .timer-count'
    ).then((solveTimeText) => {
        console.log("Solve Time:", solveTimeText);
        // Send the puzzle data to the background script for storage,
        // even if solveTimeText is null (for puzzles with a time of "0:00").
        chrome.runtime.sendMessage(
            { date: currentDate, time: solveTimeText },
            (response) => {
                console.log("Puzzle data recorded.");
                if (response?.next) {
                    // Calculate the next date and navigate automatically.
                    let currentPuzzleDate = new Date(year, month - 1, day);
                    currentPuzzleDate.setDate(currentPuzzleDate.getDate() + 1);

                    // Get today's date (without time component) for comparison.
                    const today = getPublishedPuzzleDate();
                    const currentDateOnly = new Date(
                        today.getFullYear(),
                        today.getMonth(),
                        today.getDate()
                    );

                    // If the next puzzle date is today or in the future, stop auto-navigation.
                    if (currentPuzzleDate > currentDateOnly) {
                        console.log(
                            "Reached current date. Stopping auto-navigation."
                        );
                        chrome.storage.local.set({ mode: 0 }, () => {
                            chrome.runtime.sendMessage({
                                action: "updateMode",
                                mode: 0,
                            });
                            // Default back to auto-navigation mode
                            initAutoNavigation();
                        });
                        return;
                    }

                    // Otherwise, format the next date as a URL.
                    const nextYear = currentPuzzleDate.getFullYear();
                    const nextMonth = String(
                        currentPuzzleDate.getMonth() + 1
                    ).padStart(2, "0");
                    const nextDay = String(
                        currentPuzzleDate.getDate()
                    ).padStart(2, "0");
                    const nextUrl = `https://www.nytimes.com/crosswords/game/mini/${nextYear}/${nextMonth}/${nextDay}`;
                    window.location.href = nextUrl;
                }
            }
        );
    });
}

// State 2: SonicScraper mode function
function runSonicScraper() {
    resetModes();

    const archiveStartYear = 2014;
    const archiveStartMonth = 8;
    const today = getPublishedPuzzleDate(); // use published date cutoff for today in ET
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    let pendingPuzzles = []; // Blue star puzzles needing time scraping.
    let puzzleList = []; // All puzzles will have time null initially.

    // Modified: Always add to puzzleList; if blue star exists, also queue for further scraping.
    async function fetchArchive(year, month) {
        let monthStr = String(month).padStart(2, "0");
        let url = `https://www.nytimes.com/crosswords/archive/mini/${year}/${monthStr}`;
        console.log("Opening archive in new tab:", url);
        try {
            const response = await fetch(url);
            const html = await response.text();
            let parser = new DOMParser();
            let doc = parser.parseFromString(html, "text/html");
            let items = doc.querySelectorAll(".archive_calendar-item");
            items.forEach((item) => {
                let progressIcon = item.querySelector(".progressIconContent");
                let link = item.querySelector("a.puzzleAction");
                let dayEl = item.querySelector(".date");
                if (!dayEl || !link) return;
                let day = dayEl.textContent.trim();
                let puzzleDateStr = `${month}/${day}/${year}`;
                // Always add the puzzle to puzzleList with time set to null.
                puzzleList.push({ date: puzzleDateStr, time: null });
                // If blue star exists, also add to pendingPuzzles for later time extraction.
                if (
                    progressIcon &&
                    progressIcon.classList.contains("miniProgressBlueStar")
                ) {
                    pendingPuzzles.push({
                        year,
                        month,
                        day,
                        url:
                            "https://www.nytimes.com" +
                            link.getAttribute("href"),
                        dateStr: puzzleDateStr,
                    });
                }
            });
        } catch (err) {
            console.error("Error fetching archive for", year, month, err);
        }
    }

    let fetchPromises = [];
    let year = archiveStartYear;
    let month = archiveStartMonth;
    while (
        year < currentYear ||
        (year === currentYear && month <= currentMonth)
    ) {
        fetchPromises.push(fetchArchive(year, month));
        month++;
        if (month > 12) {
            month = 1;
            year++;
        }
    }

    Promise.all(fetchPromises).then(() => {
        console.log(
            "Archive scraping complete. Pending puzzles:",
            pendingPuzzles
        );
        function scrapePending(i) {
            if (i >= pendingPuzzles.length) {
                console.log(
                    "Finished scraping pending puzzles. Final puzzleList:",
                    puzzleList
                );
                return;
            }
            let puzzle = pendingPuzzles[i];
            console.log("Scraping puzzle:", puzzle.url);
            fetch(puzzle.url)
                .then((res) => res.text())
                .then((html) => {
                    let parser = new DOMParser();
                    let doc = parser.parseFromString(html, "text/html");
                    let solveTimeElements =
                        doc.querySelectorAll("span.xwd__bold");
                    let solveTimeText =
                        solveTimeElements && solveTimeElements.length > 1
                            ? solveTimeElements[1].textContent.trim()
                            : null;
                    if (
                        solveTimeText &&
                        solveTimeText.toLowerCase().includes("second")
                    ) {
                        const seconds = parseInt(solveTimeText);
                        if (!isNaN(seconds)) {
                            const minutes = Math.floor(seconds / 60);
                            const remSeconds = seconds % 60;
                            solveTimeText = `${minutes}:${remSeconds
                                .toString()
                                .padStart(2, "0")}`;
                        }
                    }
                    let idx = puzzleList.findIndex(
                        (p) => p.date === puzzle.dateStr
                    );
                    if (idx >= 0) {
                        puzzleList[idx].time = solveTimeText;
                    }
                    console.log(
                        `Puzzle on ${puzzle.dateStr} solved in ${solveTimeText}`
                    );
                    scrapePending(i + 1);
                })
                .catch((err) => {
                    console.error("Error scraping puzzle:", err);
                    scrapePending(i + 1);
                });
        }
        scrapePending(0);
    });
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "showNavButton") {
        resetModes();
        initAutoNavigation();
        return;
    }
    if (message.action === "navigateCrossword") {
        console.log(
            "Popup requested crossword navigation: starting crossword navigation loop"
        );
        chrome.storage.local.set({ autoNavActive: true }, () => {
            // Use shared helper in utils.js
            navigateCrossword();
        });
        return;
    }
    if (message.action === "updateMode") {
        chrome.storage.local.set({ mode: message.mode }, () => {
            chrome.runtime.sendMessage({
                action: "updateMode",
                mode: message.mode,
            });
        });
    }
    if (message.mode === 1) {
        runScrape();
    } else if (message.mode === 2) {
        runSonicScraper();
    } else {
        initAutoNavigation();
    }
});

// On initial load: choose mode or resume auto-navigation
chrome.storage.local.get({ mode: 0, autoNavActive: false }, (data) => {
    if (data.mode === 1) {
        runScrape();
    } else if (data.mode === 2) {
        runSonicScraper();
    } else {
        if (data.autoNavActive) {
            resetModes();
            startAutoNavigationLoop();
        } else {
            initAutoNavigation();
        }
    }
});
