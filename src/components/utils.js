// Shared helper for finding the latest unsolved puzzle date
// puzzles: Array of { date: "M/D/YYYY", time: string }
// startDate: JS Date object (defaults to Aug 21, 2014)

// Add helper to compute actual puzzle publish date based on EST availability
function getPublishedPuzzleDate() {
    // Get current time in Eastern Time
    const nowET = new Date(
        new Date().toLocaleString("en-US", { timeZone: "America/New_York" })
    );
    const day = nowET.getDay(); // 0=Sunday, ...,6=Saturday
    const hour = nowET.getHours();
    const pubDate = new Date(nowET);
    if (day === 6) {
        // Saturday: Sunday puzzle available from Saturday 18:00 ET
        if (hour >= 18) pubDate.setDate(pubDate.getDate() + 1);
    } else {
        // Other days: next puzzle available at 22:00 ET
        if (hour >= 22) pubDate.setDate(pubDate.getDate() + 1);
    }
    // Zero out time component so comparators only care about calendar date
    pubDate.setHours(0, 0, 0, 0);
    return pubDate;
}

function getLatestUnsolvedFromDate(
    puzzles,
    date = getPublishedPuzzleDate(),
    firstDate = new Date("2014-08-21")
) {
    let d = new Date(date);
    d.setHours(0, 0, 0, 0);
    while (d >= firstDate) {
        const dateStr = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
        const entry = puzzles.find((p) => p.date === dateStr);
        if (
            !entry ||
            !entry.time ||
            entry.time.trim() === "" ||
            entry.time.trim().toLowerCase() === "null"
        ) {
            return dateStr;
        }
        d.setDate(d.getDate() - 1);
    }
    // fallback to provided date
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

// Helper: returns a safe URL, redirecting to main crosswords page if before threshold date 8/21/14
function safeUrl(url) {
    // Only redirect to main crosswords page if URL date is before Mini launch (Aug 21, 2014)
    const threshold = new Date("2014-08-21");
    const datePattern = /(\d{4})\/(\d{2})\/(\d{2})/;
    const match = url.match(datePattern);
    if (match) {
        const [, year, month, day] = match;
        const dateObj = new Date(`${year}-${month}-${day}`);
        if (dateObj < threshold) {
            return "https://www.nytimes.com/crosswords";
        }
    }
    return url;
}

// Helper: navigates window to a safe URL
function safeNavigate(url) {
    window.location.href = safeUrl(url);
}

// Helper: handle fallback navigation when nextDateStr equals currentDateStr
function handleFallbackNavigation(pageDate, url, datePattern, isBaseUrl) {
    const backDate = new Date(pageDate);
    backDate.setDate(backDate.getDate() - 1);
    const m1 = String(backDate.getMonth() + 1).padStart(2, "0");
    const d1 = String(backDate.getDate()).padStart(2, "0");
    const y1 = backDate.getFullYear();
    const target = `${y1}/${m1}/${d1}`;
    const nextUrl = isBaseUrl
        ? `https://www.nytimes.com/crosswords/game/mini/${target}`
        : url.replace(datePattern, target);
    window.location.href = nextUrl;
}

// Shared helper: navigate to nearest unsolved puzzle, recording solved puzzles and stopping at first unsolved
function navigateToNearestUnsolved(startDate, puzzles, isBaseUrl = false) {
    const url = window.location.href;
    const datePattern = /(\d{4})\/(\d{2})\/(\d{2})/;
    // Derive the actual page date from URL instead of using startDate directly
    const match = url.match(datePattern);
    // If triggered as base URL (crossword button), always use startDate; otherwise use URL date if present
    const pageDate =
        !isBaseUrl && match
            ? new Date(
                  parseInt(match[1], 10),
                  parseInt(match[2], 10) - 1,
                  parseInt(match[3], 10)
              )
            : new Date(startDate);
    const currentDateStr = `${
        pageDate.getMonth() + 1
    }/${pageDate.getDate()}/${pageDate.getFullYear()}`;
    // Wait for timer element (or timeout) to capture solve time on this page
    waitForTimerElement(
        'button[aria-label="Timer Play Button"] .timer-count',
        2000
    ).then((timeStr) => {
        // Record time if solved
        if (timeStr && timeStr !== "0:00") {
            const idx = puzzles.findIndex((p) => p.date === currentDateStr);
            if (idx > -1) puzzles[idx].time = timeStr;
            else puzzles.push({ date: currentDateStr, time: timeStr });
            chrome.storage.local.set({ puzzles });
        }
        // Determine next unsolved puzzle date (backward) starting from the day before
        const searchDate = new Date(pageDate);
        searchDate.setDate(searchDate.getDate() - 1);
        let nextDateStr = getLatestUnsolvedFromDate(puzzles, searchDate);
        // Handle fallback navigation if nextDateStr equals currentDateStr
        if (!isBaseUrl && nextDateStr === currentDateStr) {
            handleFallbackNavigation(pageDate, url, datePattern, isBaseUrl);
            return;
        }
        // If this page is unsolved (0:00 or no entry), stop loop
        if (!timeStr || timeStr === "0:00") {
            chrome.storage.local.set({ autoNavActive: false }, () => {
                if (typeof initAutoNavigation === "function")
                    initAutoNavigation();
            });
            return;
        }
        // Else navigate to nextDateStr
        const [m, d, y] = nextDateStr.split("/");
        const mm = m.padStart(2, "0");
        const dd = d.padStart(2, "0");
        const target = `${y}/${mm}/${dd}`;
        const nextUrl = isBaseUrl
            ? `https://www.nytimes.com/crosswords/game/mini/${target}`
            : url.replace(datePattern, target);
        window.location.href = nextUrl;
    });
}

// Helper: Observe the congrats modal, record solve time, and auto-navigate to the next unsolved puzzle
function observeSolveAndNavigate(currentDate, isBaseUrl = false) {
    // Observe the solve modal; track in navObserver for cleanup
    navObserver = new MutationObserver(() => {
        console.log(
            "observeSolveAndNavigate: mutation detected, checking for congrats modal"
        );
        const solveTimeElements = document.querySelectorAll(
            "div.mini__congrats-modal--message span.xwd__bold"
        );
        if (solveTimeElements.length > 1) {
            let solveTimeText = solveTimeElements[1].innerText.trim();
            console.log(
                "observeSolveAndNavigate: congrats modal found, time=",
                solveTimeText
            );
            if (solveTimeText.toLowerCase().includes("second")) {
                const seconds = parseInt(solveTimeText);
                if (!isNaN(seconds)) {
                    const minutes = Math.floor(seconds / 60);
                    const remSeconds = seconds % 60;
                    solveTimeText = `${minutes}:${String(remSeconds).padStart(
                        2,
                        "0"
                    )}`;
                }
            }
            const puzzleDateStr = `${
                currentDate.getMonth() + 1
            }/${currentDate.getDate()}/${currentDate.getFullYear()}`;
            chrome.storage.local.get({ puzzles: [] }, (data) => {
                const puzzles = data.puzzles;
                const idx = puzzles.findIndex((p) => p.date === puzzleDateStr);
                if (idx > -1) puzzles[idx].time = solveTimeText;
                else puzzles.push({ date: puzzleDateStr, time: solveTimeText });
                chrome.storage.local.set({ puzzles }, () => {
                    // After recording solve time, navigate to the next unsolved puzzle
                    setTimeout(() => {
                        navigateToNearestUnsolved(
                            currentDate,
                            puzzles,
                            isBaseUrl
                        );
                    }, 1500);
                });
            });
            navObserver.disconnect();
        }
    });
    // Start observing the page for the congrats modal
    navObserver.observe(document.body, { childList: true, subtree: true });
}

// Helper: Start the auto-navigation loop by navigating to the next unsolved puzzle
function startAutoNavigationLoop() {
    // Ensure auto-navigation flag is set
    chrome.storage.local.set({ autoNavActive: true }, () => {
        // Determine current puzzle date from URL
        const url = window.location.href;
        const datePattern = /(\d{4})\/(\d{2})\/(\d{2})/;
        const match = url.match(datePattern);
        const currentDate = match
            ? new Date(
                  parseInt(match[1], 10),
                  parseInt(match[2], 10) - 1,
                  parseInt(match[3], 10)
              )
            : getPublishedPuzzleDate();
        const isBaseUrl = !match;
        const currentDateStr = `${
            currentDate.getMonth() + 1
        }/${currentDate.getDate()}/${currentDate.getFullYear()}`;
        // Fetch stored puzzles and navigate backwards until an unsolved puzzle is found
        chrome.storage.local.get({ puzzles: [] }, (data) => {
            navigateToNearestUnsolved(currentDate, data.puzzles, isBaseUrl);
        });
    });
}

// Helper: Navigate backwards from today's date for crossword button
function navigateCrossword() {
    chrome.storage.local.get({ puzzles: [] }, (data) => {
        const puzzles = data.puzzles;
        const today = getPublishedPuzzleDate();
        navigateToNearestUnsolved(today, puzzles, true);
    });
}
