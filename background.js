// --- background.js ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.date) {
        chrome.storage.local.get({ puzzles: [] }, (result) => {
            let puzzles = result.puzzles;

            // Check if an entry for this date already exists and remove it.
            const existingIndex = puzzles.findIndex(puzzle => puzzle.date === message.date);
            if (existingIndex !== -1) {
                puzzles.splice(existingIndex, 1);
            }

            // Add the new puzzle data.
            puzzles.push({ date: message.date, time: message.time });

            chrome.storage.local.set({ puzzles: puzzles }, () => {
                sendResponse({ next: true });
            });
        });
        // Return true to indicate an asynchronous response.
        return true;
    }
});
