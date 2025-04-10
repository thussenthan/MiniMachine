// --- summary.js ---
document.addEventListener("DOMContentLoaded", () => {
    const clearDataButton = document.getElementById("clearData");
    const exportCSVButton = document.getElementById("exportCSV");
    const puzzleList = document.getElementById("puzzleList");

    // Helper: Converts "m:ss" to seconds.
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

    function filterPuzzleData(puzzleList, saturdaysOnly) {
        return puzzleList.filter(puzzle => {
            const dateObj = new Date(puzzle.date);
            return saturdaysOnly ? dateObj.getDay() === 6 : dateObj.getDay() !== 6;
        });
    }

    // Helper function: Filters an array of puzzles to only those within the last 'days' days.
    function filterPuzzlesByDays(puzzles, days) {
        const today = new Date();
        const startDate = new Date();
        startDate.setDate(today.getDate() - days);
        return puzzles.filter(puzzle => {
            const puzzleDate = new Date(puzzle.date);
            return puzzleDate >= startDate;
        });
    }

    // Helper: Computes summary statistics and prepares chart data for puzzle times.
    function computePuzzleStatistics(puzzles, totalPossiblePuzzles, lineChartId, histogramChartId) {

        // 1. Compute percentage of completed puzzles.
        const completedPercentage = (puzzles.length / totalPossiblePuzzles) * 100;
        // 2. Collect all puzzle times (in seconds) in an array and filter out any null values/entries.
        const times = puzzles.map(p => timeToSeconds(p.time)).filter(t => t !== null);
        if (times.length === 0) {
            console.warn("No valid puzzle times available to compute statistics.");
            return {
                completedPercentage,
                mean: null,
                stdDev: null,
                median: null,
                mode: null,
                lineChartData: null,
                histogramData: null
            };
        }
        // 3. Compute Mean.
        const sum = times.reduce((acc, t) => acc + t, 0);
        const mean = sum / times.length;
        // 4. Compute Standard Deviation.
        const variance = times.reduce((acc, t) => acc + Math.pow(t - mean, 2), 0) / times.length;
        const stdDev = Math.sqrt(variance);
        // 5. Compute Median.
        const sortedTimes = [...times].sort((a, b) => a - b);
        let median;
        const midIndex = Math.floor(sortedTimes.length / 2);
        if (sortedTimes.length % 2 === 0) {
            median = (sortedTimes[midIndex - 1] + sortedTimes[midIndex]) / 2;
        } else {
            median = sortedTimes[midIndex];
        }
        // 6. Compute Mode (the most frequently occurring time, if there is one).
        const frequency = {};
        times.forEach(t => {
            frequency[t] = (frequency[t] || 0) + 1;
        });
        let mode = null;
        let maxFreq = 0;
        Object.keys(frequency).forEach(t => {
            if (frequency[t] > maxFreq) {
                maxFreq = frequency[t];
                mode = Number(t);
            }
        });
        // 7. Prepare data for the line chart (plot of puzzle times over chronological time).
        // Sort the puzzles by date.
        const sortedPuzzles = [...puzzles].sort((a, b) => new Date(a.date) - new Date(b.date));
        const lineLabels = sortedPuzzles.map(p => p.date);
        const lineData = sortedPuzzles.map(p => timeToSeconds(p.time));
        // 8. Prepare histogram data.
        // Define number of bins (for example, 10) and compute bin width.
        const binCount = 10;
        const minTime = Math.min(...times);
        const maxTime = Math.max(...times);
        const binWidth = (maxTime - minTime) / binCount;
        const histogramBins = new Array(binCount).fill(0);
        times.forEach(t => {
            let binIndex = Math.floor((t - minTime) / binWidth);
            if (binIndex === binCount) binIndex = binCount - 1; // Handle t equal to maxTime edge case.
            histogramBins[binIndex]++;
        });
        // Create labels for each bin.
        const histogramLabels = [];
        for (let i = 0; i < binCount; i++) {
            const lower = Math.round(minTime + i * binWidth);
            const upper = Math.round(minTime + (i + 1) * binWidth);
            histogramLabels.push(`${lower}-${upper}`);
        }
        // 9. Optional: Render the charts if canvas element/container IDs are provided and Chart.js is available and loaded.
        if (lineChartId && typeof Chart !== "undefined") {
            const ctxLine = document.getElementById(lineChartId)?.getContext("2d");
            if (ctxLine) {
                new Chart(ctxLine, {
                    type: "line",
                    data: {
                        labels: lineLabels,
                        datasets: [{
                            label: "Puzzle Time (seconds)",
                            data: lineData,
                            fill: false,
                            borderColor: "blue"
                        }]
                    },
                    options: {
                        scales: {
                            x: { title: { display: true, text: "Date" } },
                            y: { title: { display: true, text: "Time (seconds)" } }
                        }
                    }
                });
            }
        }
        if (histogramChartId && typeof Chart !== "undefined") {
            const ctxHist = document.getElementById(histogramChartId)?.getContext("2d");
            if (ctxHist) {
                new Chart(ctxHist, {
                    type: "bar",
                    data: {
                        labels: histogramLabels,
                        datasets: [{
                            label: "Frequency",
                            data: histogramBins,
                            backgroundColor: "lightgray",
                            borderColor: "black"
                        }]
                    },
                    options: {
                        scales: {
                            x: { title: { display: true, text: "Puzzle Time Bins (s)" } },
                            y: { title: { display: true, text: "Frequency" } }
                        }
                    }
                });
            }
        }
        // 10. Return all computed statistics and chart data.
        return {
            completedPercentage,
            mean,
            stdDev,
            median,
            mode,
            lineChartData: { labels: lineLabels, data: lineData },
            histogramData: { labels: histogramLabels, data: histogramBins, binWidth, minTime }
        };
    }

    // Usage: Compute statistics and render charts.
    // At the end of your summary.js file (or merged into your chrome.storage.local.get callback)
    chrome.storage.local.get({ puzzles: [] }, (data) => {
        const puzzles = data.puzzles;
        const totalPossiblePuzzles = 100; // Adjust as needed

        // Define groups:
        // All puzzles over specific time ranges.
        const group7 = filterPuzzlesByDays(puzzles, 7);
        const group30 = filterPuzzlesByDays(puzzles, 30);
        const group365 = filterPuzzlesByDays(puzzles, 365);
        const groupAll = puzzles;  // All puzzles over all days

        // For the 365-day group, further filter into Saturday and non-Saturday puzzles.
        const groupSaturday365 = filterPuzzleData(group365, true);
        const groupNonSaturday365 = filterPuzzleData(group365, false);

        // For all-time puzzles, filter into Saturday and non-Saturday puzzles.
        const groupSaturdayAll = filterPuzzleData(groupAll, true);
        const groupNonSaturdayAll = filterPuzzleData(groupAll, false);

        // Compute statistics for each group. Pass null for chart container IDs if you don’t need charts in these cases.
        const stats7 = computePuzzleStatistics(group7, totalPossiblePuzzles, null, null);
        const stats30 = computePuzzleStatistics(group30, totalPossiblePuzzles, null, null);
        const statsSaturday365 = computePuzzleStatistics(groupSaturday365, totalPossiblePuzzles, null, null);
        const statsNonSaturday365 = computePuzzleStatistics(groupNonSaturday365, totalPossiblePuzzles, null, null);
        const statsAll = computePuzzleStatistics(groupAll, totalPossiblePuzzles, null, null);
        const statsSaturdayAll = computePuzzleStatistics(groupSaturdayAll, totalPossiblePuzzles, null, null);
        const statsNonSaturdayAll = computePuzzleStatistics(groupNonSaturdayAll, totalPossiblePuzzles, null, null);

        // Helper: Format the statistics into an HTML snippet.
        function formatStats(label, stats) {
            return `<h3>${label}</h3>
                <ul>
                  <li>Completed Percentage: ${stats.completedPercentage.toFixed(2)}%</li>
                  <li>Mean Time: ${stats.mean ? stats.mean.toFixed(2) + " s" : "N/A"}</li>
                  <li>Standard Deviation: ${stats.stdDev ? stats.stdDev.toFixed(2) + " s" : "N/A"}</li>
                  <li>Median Time: ${stats.median ? stats.median.toFixed(2) + " s" : "N/A"}</li>
                  <li>Mode Time: ${stats.mode ? stats.mode.toFixed(2) + " s" : "N/A"}</li>
                </ul>`;
        }

        // Create a container element to hold the summary statistics.
        let statsContainer = document.createElement("div");
        statsContainer.id = "statsContainer";
        statsContainer.innerHTML = "<h2>Summary Statistics</h2>" +
            formatStats("All puzzles (Last 7 days)", stats7) +
            formatStats("All puzzles (Last 30 days)", stats30) +
            formatStats("Saturday puzzles (Last 365 days)", statsSaturday365) +
            formatStats("Non-Saturday puzzles (Last 365 days)", statsNonSaturday365) +
            formatStats("All puzzles (All time)", statsAll) +
            formatStats("Saturday puzzles (All time)", statsSaturdayAll) +
            formatStats("Non-Saturday puzzles (All time)", statsNonSaturdayAll);

        // Append the stats container to your HTML page.
        document.body.appendChild(statsContainer);
    });

    // Function to update the filtered container with puzzles from the last 'days' days,
    // sorted from fastest (top) to slowest.
    function updateFilteredPuzzleList(days, containerId) {
        const container = document.getElementById(containerId);
        chrome.storage.local.get({ puzzles: [] }, (data) => {
            let filteredPuzzles = filterPuzzlesByDays(data.puzzles, days);
            // Sort the filtered puzzles by solve time (in seconds), with fastest first. (using the timeToSeconds helper)
            filteredPuzzles.sort((a, b) => {
                const aTime = timeToSeconds(a.time);
                const bTime = timeToSeconds(b.time);
                if (aTime === null && bTime === null) return 0;
                if (aTime === null) return 1;     // Push puzzles with no time to the end.
                if (bTime === null) return -1;
                return aTime - bTime;
            });
            container.innerHTML = "";
            if (filteredPuzzles.length === 0) {
                const li = document.createElement("li");
                li.textContent = `No puzzles in the last ${days} days.`;
                container.appendChild(li);
            } else {
                filteredPuzzles.forEach((puzzle) => {
                    container.appendChild(createPuzzleListItem(puzzle));
                });
            }
        });
    }

    // Usage: Update the filtered list to show puzzles from the last 365 days.
    updateFilteredPuzzleList(7, "filteredList7");
    updateFilteredPuzzleList(30, "filteredList30");
    updateFilteredPuzzleList(365, "filteredList365");
    updateFilteredPuzzleList(10000, "filteredListAll"); // Show all puzzles

    // Clear stored puzzles data
    clearDataButton.addEventListener("click", () => {
        if (window.confirm("Are you sure you want to delete all historical data? \n This action cannot be undone.")) {
            chrome.storage.local.set({ puzzles: [] }, () => {
                updatePuzzleList();
                updateFilteredPuzzleList(7, "filteredList7");
                updateFilteredPuzzleList(30, "filteredList30");
                updateFilteredPuzzleList(365, "filteredList365");
                updateFilteredPuzzleList(10000, "filteredListAll");
            });
        }
    });


    // Export puzzles to CSV
    exportCSVButton.addEventListener("click", () => {
        chrome.storage.local.get({ puzzles: [] }, (data) => {
            const puzzles = data.puzzles;
            if (!puzzles.length) {
                alert("No puzzles saved to export.");
                return;
            }
            let csvContent = "data:text/csv;charset=utf-8,Date,Time\n";
            puzzles.forEach((puzzle) => {
                csvContent += `${puzzle.date},${puzzle.time}\n`;
            });
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "puzzles.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    });

    // Helper function to import a CSV file into storage.
    function importCSVFile(file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const text = e.target.result;
            let lines = text.split("\n").filter(line => line.trim() !== "");
            // Remove header (assumes first line is "Date,Time")
            lines.shift();
            const importedPuzzles = [];
            lines.forEach(line => {
                const parts = line.split(",");
                if (parts.length >= 2) {
                    const date = parts[0].trim();
                    const time = parts[1].trim();
                    importedPuzzles.push({ date, time });
                }
            });
            // Merge imported puzzles with existing ones (replace duplicates by date)
            chrome.storage.local.get({ puzzles: [] }, (data) => {
                let existing = data.puzzles;
                importedPuzzles.forEach(newPuzzle => {
                    const idx = existing.findIndex(p => p.date === newPuzzle.date);
                    if (idx > -1) {
                        // Replace existing puzzle with the new one
                        existing[idx] = newPuzzle;
                    } else {
                        existing.push(newPuzzle);
                    }
                });
                chrome.storage.local.set({ puzzles: existing }, () => {
                    // Display a success message for 3 seconds.
                    const importStatus = document.getElementById("importStatus");
                    if (importStatus) {
                        importStatus.textContent = "CSV import successful!";
                        setTimeout(() => {
                            importStatus.textContent = "";
                        }, 3000);
                    }
                    console.log("CSV import complete.");
                    // Update UI lists after importing.
                    updatePuzzleList();
                    updateFilteredPuzzleList(7, "filteredList7");
                    updateFilteredPuzzleList(30, "filteredList30");
                    updateFilteredPuzzleList(365, "filteredList365");
                    updateFilteredPuzzleList(10000, "filteredListAll");
                });
            });
        };
        reader.readAsText(file);
    }

    // Wire up the file input change event to our import function.
    const importCSVInput = document.getElementById("importCSV");
    if (importCSVInput) {
        importCSVInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file) {
                importCSVFile(file);
            }
        });
    }

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
            updateFilteredPuzzleList(7, "filteredList7");
            updateFilteredPuzzleList(30, "filteredList30");
            updateFilteredPuzzleList(365, "filteredList365");
            updateFilteredPuzzleList(10000, "filteredListAll");

        }
    });
});
