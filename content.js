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
    console.log(
        "Auto-navigation mode active. Current URL:",
        window.location.href
    );

    // Extract the date from the URL (YYYY/MM/DD)
    const url = window.location.href;
    const datePattern = /(\d{4})\/(\d{2})\/(\d{2})/;
    const dateMatch = url.match(datePattern);
    if (!dateMatch) {
        console.error("Date not found in the URL.");
        return;
    }

    // Create a Date object from the extracted date
    const currentDate = new Date(
        `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
    );

    // Check if the current puzzle date is today. If so, skip auto-navigation.
    const today = new Date();
    if (
        currentDate.getFullYear() === today.getFullYear() &&
        currentDate.getMonth() === today.getMonth() &&
        currentDate.getDate() === today.getDate()
    ) {
        console.log("Today's puzzle active. Skipping auto-navigation back.");
        return;
    }

    // Decrement the date by one day
    const prevDate = new Date(currentDate);
    prevDate.setDate(currentDate.getDate() - 1);
    // Format the previous date as YYYY/MM/DD
    const prevDateStr = prevDate.toISOString().split("T")[0].replace(/-/g, "/");
    // Generate the new URL
    const prevUrl = url.replace(datePattern, prevDateStr);

    // Create a navigation button and attach it to the page
    const button = document.createElement("button");
    button.id = "navBtn";
    button.textContent = "Go Back a Puzzle";
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
    button.addEventListener("click", () => {
        window.location.href = prevUrl;
    });
    document.body.appendChild(button);
    console.log("Navigation button added.");

    // Auto-navigate when the modal is detected
    navObserver = new MutationObserver(() => {
        const targetElement = document.querySelector(
            `.${"xwd__center mini__congrats-modal--message".replace(
                /\s+/g,
                "."
            )}`
        );
        if (targetElement) {
            // Record the solve time before navigating using the second bold element
            const solveTimeElements = document.querySelectorAll(
                "div.xwd__center.mini__congrats-modal--message span.xwd__bold"
            );
            let solveTimeText =
                solveTimeElements && solveTimeElements.length > 1
                    ? solveTimeElements[1].innerText.trim()
                    : null;
            // Convert time format if in seconds form (e.g., "34 seconds")
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
            // Format date as MM/DD/YYYY
            const puzzleDateStr = `${
                currentDate.getMonth() + 1
            }/${currentDate.getDate()}/${currentDate.getFullYear()}`;
            chrome.runtime.sendMessage(
                { date: puzzleDateStr, time: solveTimeText },
                (response) => {
                    console.log("Puzzle data recorded (auto-navigation mode).");
                }
            );
            console.log(
                "Modal detected. Redirecting in 1.5 seconds to:",
                prevUrl
            );
            setTimeout(() => {
                window.location.href = prevUrl;
            }, 1500);
            navObserver.disconnect();
        }
    });
    navObserver.observe(document.body, { childList: true, subtree: true });
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
                    const today = new Date();
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
    const today = new Date();
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

// Listen for messages from the popup to automatically update the mode state immediately.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

// On initial load: Check mode state in storage and run the corresponding function.
chrome.storage.local.get({ mode: 0 }, (data) => {
    if (data.mode === 1) {
        runScrape();
    } else if (data.mode === 2) {
        runSonicScraper();
    } else {
        initAutoNavigation();
    }
});
