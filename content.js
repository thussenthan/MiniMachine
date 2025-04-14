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
                resolve(element.innerText.trim());  // Resolve with the timer value
            }
            timeElapsed += intervalTime;
            if (timeElapsed >= maxWait) {
                clearInterval(interval);
                resolve(null);  // Resolve with `null` if nothing is found
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

// Mode 1: Auto-navigation functionality.
function initAutoNavigation() {
    console.log("Auto-navigation mode active. Current URL:", window.location.href);

    // Ensure any previous nav button is removed
    removeNavButton();

    // Extract the date from the URL (YYYY/MM/DD)
    const url = window.location.href;
    const datePattern = /(\d{4})\/(\d{2})\/(\d{2})/;
    const dateMatch = url.match(datePattern);
    if (!dateMatch) {
        console.error("Date not found in the URL.");
        return;
    }

    // Create a Date object from the extracted date
    const currentDate = new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`);
    // Decrement the date by one day
    const prevDate = new Date(currentDate);
    prevDate.setDate(currentDate.getDate() - 1);
    // Format the previous date as YYYY/MM/DD
    const prevDateStr = prevDate.toISOString().split("T")[0].replace(/-/g, '/');
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
    const targetClass = 'xwd__center mini__congrats-modal--message';
    const observer = new MutationObserver(() => {
        const targetElement = document.querySelector(`.${targetClass.replace(/\s+/g, '.')}`);
        if (targetElement) {
            console.log("Modal detected. Redirecting in 2 seconds to:", prevUrl);
            setTimeout(() => {
                window.location.href = prevUrl;
            }, 2000);
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

// Mode 2: Scraping mode (gathers data without auto-navigation)
function runScrape() {
    console.log("Scrape mode active. Gathering puzzle data.");
    // Remove any navigation button for scraping mode.
    removeNavButton();

    // Extract date parts from URL.
    const urlParts = window.location.pathname.split('/');
    if (urlParts.length < 7) {
        console.error("Unexpected URL structure; cannot extract date.");
        return;
    }
    const year = urlParts[4];
    const month = parseInt(urlParts[5], 10); // Converts "03" to 3
    const day = parseInt(urlParts[6], 10);   // Converts "07" to 7
    const currentDate = `${month}/${day}/${year}`;

    waitForTimerElement('button[aria-label="Timer Play Button"] .timer-count')
        .then((solveTimeText) => {
            console.log("Solve Time:", solveTimeText);
            // Send the puzzle data to the background script for storage,
            // even if solveTimeText is null (for puzzles with a time of "0:00").
            chrome.runtime.sendMessage({ date: currentDate, time: solveTimeText }, (response) => {
                console.log("Puzzle data recorded.");
                if (response?.next) {
                    // Calculate the next date and navigate automatically.
                    let currentPuzzleDate = new Date(year, month - 1, day);
                    currentPuzzleDate.setDate(currentPuzzleDate.getDate() + 1);

                    // Get today's date (without time component) for comparison.
                    const today = new Date();
                    const currentDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

                    // If the next puzzle date is today or in the future, stop auto-navigation.
                    if (currentPuzzleDate > currentDateOnly) {
                        console.log("Reached current date. Stopping auto-navigation.");
                        chrome.storage.local.set({ scrapeMode: false }, () => {
                            chrome.runtime.sendMessage({ action: "updateMode", scrapeMode: false });
                            // Default back to auto-navigation mode
                            initAutoNavigation();
                        });
                        return;
                    }

                    // Otherwise, format the next date as a URL.
                    const nextYear = currentPuzzleDate.getFullYear();
                    const nextMonth = String(currentPuzzleDate.getMonth() + 1).padStart(2, '0');
                    const nextDay = String(currentPuzzleDate.getDate()).padStart(2, '0');
                    const nextUrl = `https://www.nytimes.com/crosswords/game/mini/${nextYear}/${nextMonth}/${nextDay}`;
                    window.location.href = nextUrl;
                }
            });
        });
}

// Listen for messages from the popup to automatically update the mode immediately.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "updateMode") {
        console.log("Content script received updateMode message; new scrapeMode:", message.scrapeMode);
        if (message.scrapeMode) {
            runScrape();
        } else {
            initAutoNavigation();
        }
    }
});

// On initial load: Check mode in storage and run the corresponding function.
chrome.storage.local.get({ scrapeMode: false }, (data) => {
    if (data.scrapeMode) {
        runScrape();
    } else {
        initAutoNavigation();
    }
});
