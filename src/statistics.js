// --- statistics.js ---
document.addEventListener("DOMContentLoaded", () => {
    const ACCENT_COLOR =
        getComputedStyle(document.documentElement)
            .getPropertyValue("--accent-color")
            .trim() || "#6493E6"; // accent color constant
    const clearDataButton = document.getElementById("clearData");
    const exportCSVButton = document.getElementById("exportCSV");
    const puzzleList = document.getElementById("puzzleList");
    const inlineStatsEl = document.getElementById("inlineStats");

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
        if (puzzleDate.getDay() === 6) {
            // Saturday: accent
            li.classList.add("saturday");
            li.innerHTML = `<strong>Date: ${puzzle.date}, Time: ${puzzle.time}</strong>`;
        } else {
            li.textContent = `Date: ${puzzle.date}, Time: ${puzzle.time}`;
        }
        return li;
    }

    // Helper: Filters an array of puzzles to only those that are Saturdays or non-Saturdays.
    // 'saturdaysOnly' is true for Saturdays, false for non-Saturdays.
    function filterPuzzleData(puzzleList, saturdaysOnly) {
        return puzzleList.filter((puzzle) => {
            const dateObj = new Date(puzzle.date);
            return saturdaysOnly
                ? dateObj.getDay() === 6
                : dateObj.getDay() !== 6;
        });
    }

    // Helper function: Filters an array of puzzles to only those within the last 'days' days.
    function filterPuzzlesByDays(puzzles, days) {
        const today = getPublishedPuzzleDate();
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - days);
        return puzzles.filter((puzzle) => {
            const puzzleDate = new Date(puzzle.date);
            return puzzleDate >= startDate;
        });
    }

    // Add this helper function after DOMContentLoaded begins
    function zoomChart(chartType, data, options) {
        const overlay = document.createElement("div");
        overlay.style.position = "fixed";
        overlay.style.top = "0";
        overlay.style.left = "0";
        overlay.style.width = "100vw";
        overlay.style.height = "100vh";
        overlay.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
        overlay.style.display = "flex";
        overlay.style.alignItems = "center";
        overlay.style.justifyContent = "center";
        overlay.style.zIndex = "10000";

        // Create a container for the chart with a dark background instead of white.
        const container = document.createElement("div");
        container.style.width = "75vw";
        container.style.height = "75vh";
        container.style.backgroundColor = "#000"; // changed from "#fff"
        container.style.padding = "10px";
        container.style.boxSizing = "border-box";

        const fullCanvas = document.createElement("canvas");
        // Set canvas dimensions to container's dimensions.
        fullCanvas.width = container.clientWidth;
        fullCanvas.height = container.clientHeight;

        container.appendChild(fullCanvas);
        overlay.appendChild(container);
        document.body.appendChild(overlay);

        // Merge zoom plugin options into provided options.
        // (Requires chartjs-plugin-zoom to be loaded in your page.)
        const zoomOptions = {
            plugins: {
                zoom: {
                    zoom: {
                        wheel: { enabled: true },
                        // drag: { enabled: true }, // allows drag-selection for zooming
                        pinch: { enabled: true }, // pinch-zooming on touch devices
                        mode: "x", // zoom along the x-axis
                    },
                    pan: {
                        // move pan here under zoom
                        enabled: true,
                        mode: "x",
                    },
                },
            },
        };
        // Merge zoom & pan into options.plugins.zoom
        options.plugins = options.plugins || {};
        options.plugins.zoom = Object.assign(
            {},
            options.plugins.zoom,
            zoomOptions.plugins.zoom
        );

        new Chart(fullCanvas, {
            type: chartType,
            data: data,
            options: Object.assign({}, options, {
                // Ensure the chart itself uses dark mode settings:
                scales: {
                    x: {
                        // Force x-axis title off for zoomed charts
                        title: { display: false, text: "", color: "#fff" },
                        grid: { color: "rgba(255,255,255,0.2)" },
                        ticks: { color: "#fff" },
                    },
                    y: {
                        title: {
                            display: true,
                            text:
                                options.scales?.y?.title?.text || "Time (sec)",
                            color: "#fff",
                        },
                        grid: { color: "rgba(255,255,255,0.2)" },
                        ticks: { color: "#fff" },
                    },
                },
            }),
        });

        // Exit zoom by clicking anywhere on the overlay outside of the container.
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
    }

    // Helper: Computes summary statistics and prepares chart data for puzzle times.
    function computePuzzleStatistics(
        puzzles,
        totalPossiblePuzzles,
        lineChartId,
        histogramChartId
    ) {
        // 1. Compute percentage of completed puzzles.
        const completedPercentage =
            (puzzles.filter((p) => timeToSeconds(p.time) !== null).length /
                totalPossiblePuzzles) *
            100;
        // 2. Collect all puzzle times (in seconds) in an array and filter out any null values/entries.
        const times = puzzles
            .map((p) => timeToSeconds(p.time))
            .filter((t) => t !== null);
        if (times.length === 0) {
            console.log(
                "No valid puzzle times available to compute statistics."
            );
            return {
                completedPercentage: completedPercentage,
                mean: null,
                stdDev: null,
                median: null,
                mode: null,
                minTime: null,
                lineChartData: null,
                histogramData: null,
            };
        }
        // Compute minTime for fastest time display
        const minTime = Math.min(...times);
        // 3. Compute Mean.
        const sum = times.reduce((acc, t) => acc + t, 0);
        const mean = sum / times.length;
        // 4. Compute Standard Deviation.
        const variance =
            times.reduce((acc, t) => acc + Math.pow(t - mean, 2), 0) /
            times.length;
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
        times.forEach((t) => {
            frequency[t] = (frequency[t] || 0) + 1;
        });
        let mode = null;
        let maxFreq = 0;
        Object.keys(frequency).forEach((t) => {
            if (frequency[t] > maxFreq) {
                maxFreq = frequency[t];
                mode = Number(t);
            }
        });
        // 7. Prepare data for the line chart (plot of puzzle times over chronological time).
        // Sort the puzzles by date.
        const sortedPuzzles = [...puzzles].sort(
            (a, b) => new Date(a.date) - new Date(b.date)
        );
        const lineLabels = sortedPuzzles.map((p) => p.date);
        const lineData = sortedPuzzles.map((p) => timeToSeconds(p.time));

        // Prepare point background colors for Saturday and non-Saturday data points
        const pointBgColors = sortedPuzzles.map((p) =>
            new Date(p.date).getDay() === 6 ? ACCENT_COLOR : "#ffffff"
        );

        // Compute trend line data using linear regression on the index values
        let trendLineData = [];
        if (lineData.length > 1) {
            const n = lineData.length;
            let sumX = 0,
                sumY = 0;
            for (let i = 0; i < n; i++) {
                sumX += i;
                sumY += lineData[i];
            }
            const meanX = sumX / n,
                meanY = sumY / n;
            let num = 0,
                den = 0;
            for (let i = 0; i < n; i++) {
                num += (i - meanX) * (lineData[i] - meanY);
                den += Math.pow(i - meanX, 2);
            }
            const slope = num / den;
            const intercept = meanY - slope * meanX;
            trendLineData = lineData.map((_, i) => intercept + slope * i);
        } else {
            trendLineData = lineData.slice();
        }

        // 8. Prepare histogram data.
        // Define number of bins (for example, 10) and compute bin width.
        const binCount = 10;
        const minTimeHistogram = Math.min(...times);
        const maxTime = Math.max(...times);
        const binWidth = (maxTime - minTimeHistogram) / binCount;
        const histogramBins = new Array(binCount).fill(0);
        times.forEach((t) => {
            let binIndex = Math.floor((t - minTimeHistogram) / binWidth);
            if (binIndex === binCount) binIndex = binCount - 1; // Handle t equal to maxTime edge case.
            histogramBins[binIndex]++;
        });
        // Create labels for each bin.
        const histogramLabels = [];
        for (let i = 0; i < binCount; i++) {
            const lower = Math.round(minTimeHistogram + i * binWidth);
            const upper = Math.round(minTimeHistogram + (i + 1) * binWidth);
            histogramLabels.push(`${lower}-${upper}`);
        }
        // 9. Optional: Render the charts if canvas element/container IDs are provided and Chart.js is available and loaded.
        if (lineChartId && typeof Chart !== "undefined") {
            const ctxLine = document
                .getElementById(lineChartId)
                ?.getContext("2d");
            if (ctxLine) {
                // destroy previous instance if exists
                const prevLine = Chart.getChart(lineChartId);
                if (prevLine) prevLine.destroy();

                const lineChart = new Chart(ctxLine, {
                    type: "line",
                    data: {
                        labels: lineLabels,
                        datasets: [
                            {
                                label: "Time (sec)",
                                data: lineData,
                                fill: false,
                                borderColor: "#4C4C4C", // line color (updated) // changed from "#1f77b4"
                                backgroundColor: "#ffffff", // default point color for non-Saturday, changed from "#aec7e8"
                                pointBackgroundColor: pointBgColors, // per-point background colors
                                pointBorderColor: "#4C4C4C", // Use updated line color for point borders // changed from "#1f77b4"
                                pointHoverRadius: 4,
                                order: 2,
                            },
                            {
                                label: "Trend Line",
                                data: trendLineData,
                                fill: false,
                                borderColor: "#17becf", // updated trendline to teal // changed from "#ff7f0e" and "Tomato"
                                backgroundColor: "#17becf", // updated trendline to teal // changed from "#ff7f0e" and "Tomato"
                                pointRadius: 0,
                                order: 1,
                            },
                        ],
                    },
                    options: {
                        scales: {
                            x: {
                                title: {
                                    display: false,
                                    text: "",
                                    color: "#fff",
                                },
                                grid: { color: "rgba(255,255,255,0.2)" },
                                ticks: { color: "#fff" },
                            },
                            y: {
                                title: {
                                    display: true,
                                    text: "Time (sec)",
                                    color: "#fff",
                                },
                                grid: { color: "rgba(255,255,255,0.2)" },
                                ticks: { color: "#fff" },
                            },
                        },
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                filter: function (tooltipItem) {
                                    return (
                                        tooltipItem.dataset.label !==
                                        "Trend Line"
                                    );
                                },
                            },
                            zoom: {
                                pan: {
                                    enabled: true,
                                    mode: "x", // allow panning in the x-direction
                                },
                            },
                        },
                    },
                });
                ctxLine.canvas.addEventListener("click", () => {
                    zoomChart(
                        "line",
                        {
                            labels: lineLabels,
                            datasets: [
                                {
                                    label: "Time (sec)",
                                    data: lineData,
                                    fill: false,
                                    borderColor: "#4C4C4C", // updated to neutral gray // changed from "#1f77b4"
                                    backgroundColor: "#ffffff", // changed from "#aec7e8" and "DodgerBlue"
                                    pointBackgroundColor: pointBgColors, // per-point background colors
                                    pointBorderColor: "#4C4C4C", // Use updated line color for point borders in zoomed chart // changed from "#1f77b4"
                                    pointRadius: 4,
                                    pointHoverRadius: 6,
                                    order: 2,
                                },
                                {
                                    label: "Trend Line",
                                    data: trendLineData,
                                    fill: false,
                                    borderColor: "#17becf", // updated trendline to teal // changed from "#ff7f0e" and "Tomato"
                                    backgroundColor: "#17becf", // updated trendline to teal // changed from "#ff7f0e" and "Tomato"
                                    pointRadius: 0,
                                    order: 1,
                                },
                            ],
                        },
                        {
                            scales: {
                                x: {
                                    title: {
                                        display: false,
                                        text: "",
                                        color: "#fff",
                                    },
                                    grid: { color: "rgba(255,255,255,0.2)" },
                                    ticks: { color: "#fff" },
                                },
                                y: {
                                    title: {
                                        display: true,
                                        text: "Time (sec)",
                                        color: "#fff",
                                    },
                                    grid: { color: "rgba(255,255,255,0.2)" },
                                    ticks: { color: "#fff" },
                                },
                            },
                            plugins: {
                                legend: { display: false },
                                tooltip: {
                                    filter: function (tooltipItem) {
                                        return (
                                            tooltipItem.dataset.label !==
                                            "Trend Line"
                                        );
                                    },
                                },
                            },
                        }
                    );
                });
            }
        }
        if (histogramChartId && typeof Chart !== "undefined") {
            const ctxHist = document
                .getElementById(histogramChartId)
                ?.getContext("2d");
            if (ctxHist) {
                // destroy previous instance if exists
                const prevHist = Chart.getChart(histogramChartId);
                if (prevHist) prevHist.destroy();

                new Chart(ctxHist, {
                    type: "bar",
                    data: {
                        labels: histogramLabels,
                        datasets: [
                            {
                                label: "Frequency",
                                data: histogramBins,
                                backgroundColor: ACCENT_COLOR, // replaced hard-coded accent
                                borderColor: ACCENT_COLOR, // replaced hard-coded accent
                            },
                        ],
                    },
                    options: {
                        scales: {
                            x: {
                                title: {
                                    display: true,
                                    text: "Puzzle Time Bins (sec)",
                                    color: "#fff",
                                },
                                grid: { color: "rgba(255,255,255,0.2)" },
                                ticks: { color: "#fff" },
                            },
                            y: {
                                title: {
                                    display: true,
                                    text: "Frequency",
                                    color: "#fff",
                                },
                                grid: { color: "rgba(255,255,255,0.2)" },
                                ticks: { color: "#fff" },
                            },
                        },
                        plugins: { legend: { display: false } },
                    },
                });
                ctxHist.canvas.addEventListener("click", () => {
                    zoomChart(
                        "bar",
                        {
                            labels: histogramLabels,
                            datasets: [
                                {
                                    label: "Frequency",
                                    data: histogramBins,
                                    backgroundColor: "#2ca02c", // changed from "ForestGreen"
                                    borderColor: "#2ca02c", // changed from "ForestGreen"
                                },
                            ],
                        },
                        {
                            scales: {
                                x: {
                                    title: {
                                        display: true,
                                        text: "Puzzle Time Bins (sec)",
                                        color: "#fff",
                                    },
                                    grid: { color: "rgba(255,255,255,0.2)" },
                                    ticks: { color: "#fff" },
                                },
                                y: {
                                    title: {
                                        display: true,
                                        text: "Frequency",
                                        color: "#fff",
                                    },
                                    grid: { color: "rgba(255,255,255,0.2)" },
                                    ticks: { color: "#fff" },
                                },
                            },
                            plugins: { legend: { display: false } },
                        }
                    );
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
            minTime,
            lineChartData: { labels: lineLabels, data: lineData },
            histogramData: {
                labels: histogramLabels,
                data: histogramBins,
                binWidth,
                minTime: minTimeHistogram,
            },
        };
    }

    // Function to update the filtered container with puzzles from the last 'days' days,
    // sorted from fastest (top) to slowest.
    function updateFilteredPuzzleList(days, containerId) {
        const container = document.getElementById(containerId);
        chrome.storage.local.get({ puzzles: [] }, (data) => {
            let filteredPuzzles = filterPuzzlesByDays(data.puzzles, days);
            // Filter out puzzles with null or missing time (unsolved)
            filteredPuzzles = filteredPuzzles.filter(
                (puzzle) => timeToSeconds(puzzle.time) !== null
            );
            // Sort the filtered puzzles by solve time (in seconds), with fastest first. (using the timeToSeconds helper)
            filteredPuzzles.sort((a, b) => {
                const aTime = timeToSeconds(a.time);
                const bTime = timeToSeconds(b.time);
                if (aTime === null && bTime === null) return 0;
                if (aTime === null) return 1; // Push puzzles with no time to the end.
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
            // For last week, append two line breaks and then a subheading message after the list if less than 7 puzzles.
            if (days === 7) {
                // Remove any existing reminder and break elements.
                const existingReminder =
                    document.getElementById("reminder-message");
                if (existingReminder) existingReminder.remove();
                const existingBreak1 =
                    document.getElementById("reminder-break1");
                if (existingBreak1) existingBreak1.remove();
                const existingBreak2 =
                    document.getElementById("reminder-break2");
                if (existingBreak2) existingBreak2.remove();
                if (filteredPuzzles.length < 7) {
                    // Determine latest unsolved puzzle date using shared helper
                    const allPuzzles = data.puzzles;
                    const latest = getLatestUnsolvedFromDate(
                        allPuzzles,
                        getPublishedPuzzleDate()
                    );
                    const [m, d, y] = latest.split("/");
                    const formattedDate = `${y}/${m.padStart(
                        2,
                        "0"
                    )}/${d.padStart(2, "0")}`;
                    const linkTarget =
                        "https://www.nytimes.com/crosswords/game/mini/" +
                        formattedDate;
                    const safeLink = safeUrl(linkTarget);
                    const br1 = document.createElement("br");
                    br1.id = "reminder-break1";
                    container.parentElement.appendChild(br1);
                    const br2 = document.createElement("br");
                    br2.id = "reminder-break2";
                    container.parentElement.appendChild(br2);
                    const reminder = document.createElement("h3");
                    reminder.id = "reminder-message";
                    reminder.innerHTML = `Alright, you cheeky chappie—time to hop to it! Grab your cuppa, give those New York Times mini puzzles a go, and remember: <i>"If you're going through hell, keep going."</i><br>Now, show those puzzles who's boss!<br><br>Blimey, get started already <a href="${safeLink}" target="_blank" rel="noopener noreferrer" style="color:${ACCENT_COLOR}!important;">here</a> mate!`;
                    reminder.style.textAlign = "center";
                    container.parentElement.appendChild(reminder);
                }
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
        if (
            window.confirm(
                "Are you sure you want to delete all historical data?\nThis action cannot be undone."
            )
        ) {
            chrome.storage.local.set({ puzzles: [] }, () => {
                updateFilteredPuzzleList(7, "filteredList7");
                updateFilteredPuzzleList(30, "filteredList30");
                updateFilteredPuzzleList(365, "filteredList365");
                updateFilteredPuzzleList(10000, "filteredListAll");
                updateStats();
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
            link.setAttribute("download", "miniMachine_RawData.csv");
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
            let lines = text.split("\n").filter((line) => line.trim() !== "");
            // Remove header (assumes first line is "Date,Time")
            lines.shift();
            const importedPuzzles = [];
            lines.forEach((line) => {
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
                importedPuzzles.forEach((newPuzzle) => {
                    const idx = existing.findIndex(
                        (p) => p.date === newPuzzle.date
                    );
                    if (idx > -1) {
                        // Replace existing puzzle with the new one
                        existing[idx] = newPuzzle;
                    } else {
                        existing.push(newPuzzle);
                    }
                });
                chrome.storage.local.set({ puzzles: existing }, () => {
                    // Display a success message for 3 seconds.
                    const importStatus =
                        document.getElementById("importStatus");
                    if (importStatus) {
                        importStatus.textContent = "CSV import successful!";
                        setTimeout(() => {
                            importStatus.textContent = "";
                        }, 3000);
                    }
                    console.log("CSV import complete.");
                    // Update UI lists after importing.
                    updateFilteredPuzzleList(7, "filteredList7");
                    updateFilteredPuzzleList(30, "filteredList30");
                    updateFilteredPuzzleList(365, "filteredList365");
                    updateFilteredPuzzleList(10000, "filteredListAll");
                    updateStats(); // <-- Update the statistics after import
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

    // Forward clicks from the visible button to the off-screen file input.
    const importCSVButton = document.getElementById("importCSVButton");
    if (importCSVButton && importCSVInput) {
        importCSVButton.addEventListener("click", () => {
            importCSVInput.click();
        });
    }

    // Helper: Counts the number of Saturdays (if isSaturday is true) or non-Saturdays (if false)
    // in the last "days" days (including today).
    function countDaysOfWeekInRange(days, isSaturday) {
        const today = getPublishedPuzzleDate();
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - days + 1);
        let count = 0;
        for (
            let d = new Date(startDate);
            d <= today;
            d.setDate(d.getDate() + 1)
        ) {
            if (isSaturday && d.getDay() === 6) count++;
            if (!isSaturday && d.getDay() !== 6) count++;
        }
        return count;
    }

    function updateStats() {
        // Destroy any previous charts so they disappear when data is cleared
        ["lineChartAll", "lineChart7", "lineChart30", "lineChart365"].forEach(
            (id) => {
                const ch = Chart.getChart(id);
                if (ch) ch.destroy();
            }
        );
        ["histChartAll", "histChart7", "histChart30", "histChart365"].forEach(
            (id) => {
                const ch = Chart.getChart(id);
                if (ch) ch.destroy();
            }
        );

        chrome.storage.local.get({ puzzles: [] }, (data) => {
            const puzzles = data.puzzles;
            const startDate = new Date("2014-08-21");
            const today = getPublishedPuzzleDate();
            const millisecondsPerDay = 1000 * 60 * 60 * 24;
            const totalPossiblePuzzles =
                Math.floor((today - startDate) / millisecondsPerDay) + 1; // Total days since start date + 1 for today.

            // Define groups:
            const group7 = filterPuzzlesByDays(puzzles, 7);
            const group30 = filterPuzzlesByDays(puzzles, 30);
            const group365 = filterPuzzlesByDays(puzzles, 365);
            const groupAll = puzzles; // All puzzles

            // For Last Week: separate into Saturday and Non-Saturday puzzles.
            const groupSaturday7 = filterPuzzleData(group7, true);
            const groupNonSaturday7 = filterPuzzleData(group7, false);

            // For Last Month: separate into Saturday and Non-Saturday puzzles.
            const groupSaturday30 = filterPuzzleData(group30, true);
            const groupNonSaturday30 = filterPuzzleData(group30, false);

            // For the 365-day group, further filter into Saturday and Non-Saturday puzzles.
            const groupSaturday365 = filterPuzzleData(group365, true);
            const groupNonSaturday365 = filterPuzzleData(group365, false);

            // For all-time puzzles, filter into Saturday and Non-Saturday puzzles.
            const groupSaturdayAll = filterPuzzleData(groupAll, true);
            const groupNonSaturdayAll = filterPuzzleData(groupAll, false);

            // Calculate total possible Saturdays and non-Saturdays for the 365-day period.
            const totalSaturdays365 = countDaysOfWeekInRange(365, true);
            const totalNonSaturdays365 = countDaysOfWeekInRange(365, false);

            // Compute total possible Saturdays/non-Saturdays for the entire range
            const totalSaturdaysAll = countDaysOfWeekInRange(
                totalPossiblePuzzles,
                true
            );
            const totalNonSaturdaysAll = countDaysOfWeekInRange(
                totalPossiblePuzzles,
                false
            );

            // Compute statistics for each group and render charts.
            const statsOverall = computePuzzleStatistics(
                groupAll,
                totalPossiblePuzzles,
                "lineChartAll",
                "histChartAll"
            );
            const stats7 = computePuzzleStatistics(
                group7,
                7,
                "lineChart7",
                "histChart7"
            );
            const stats30 = computePuzzleStatistics(
                group30,
                30,
                "lineChart30",
                "histChart30"
            );
            const stats365 = computePuzzleStatistics(
                group365,
                365,
                "lineChart365",
                "histChart365"
            );

            // Compute Last Week stats.
            const stats7Sat = computePuzzleStatistics(
                groupSaturday7,
                countDaysOfWeekInRange(7, true),
                null,
                null
            );
            const stats7Non = computePuzzleStatistics(
                groupNonSaturday7,
                countDaysOfWeekInRange(7, false),
                null,
                null
            );
            // Compute Last Month stats.
            const stats30Sat = computePuzzleStatistics(
                groupSaturday30,
                countDaysOfWeekInRange(30, true),
                null,
                null
            );
            const stats30Non = computePuzzleStatistics(
                groupNonSaturday30,
                countDaysOfWeekInRange(30, false),
                null,
                null
            );

            // Compute statistics for each group.
            const statsSaturday365 = computePuzzleStatistics(
                groupSaturday365,
                totalSaturdays365,
                null,
                null
            );
            const statsNonSaturday365 = computePuzzleStatistics(
                groupNonSaturday365,
                totalNonSaturdays365,
                null,
                null
            );
            const statsSaturdayAll = computePuzzleStatistics(
                groupSaturdayAll,
                totalSaturdaysAll,
                null,
                null
            );
            const statsNonSaturdayAll = computePuzzleStatistics(
                groupNonSaturdayAll,
                totalNonSaturdaysAll,
                null,
                null
            );

            // --- NEW: inline summary stats ---
            if (inlineStatsEl) {
                // 1. Solved count & %
                const solved = puzzles.filter(
                    (p) => timeToSeconds(p.time) !== null
                ).length;
                const pct = (solved / totalPossiblePuzzles) * 100;

                // 2. Current streak or most recent
                const doneDates = new Set(
                    puzzles
                        .filter((p) => timeToSeconds(p.time) !== null)
                        .map((p) => new Date(p.date).toDateString())
                );
                let streak = 0,
                    d = getPublishedPuzzleDate();
                while (doneDates.has(d.toDateString())) {
                    streak++;
                    d.setDate(d.getDate() - 1);
                }
                let streakText = streak
                    ? `${streak} day${streak > 1 ? "s" : ""}`
                    : `Latest: ${
                          puzzles
                              .filter((p) => timeToSeconds(p.time) !== null)
                              .sort(
                                  (a, b) => new Date(b.date) - new Date(a.date)
                              )[0]?.date || "N/A"
                      }`;

                // Define stats for inline display
                const best =
                    statsOverall.minTime != null
                        ? `${statsOverall.minTime.toFixed(0)} s`
                        : "N/A";
                const bestSat =
                    statsSaturdayAll.minTime != null
                        ? `${statsSaturdayAll.minTime.toFixed(0)} s`
                        : "N/A";
                const avgAll =
                    statsOverall.mean != null
                        ? `${statsOverall.mean.toFixed(1)} s`
                        : "N/A";

                // Determine HTML for streak or latest with link
                let streakHTML;
                if (!streak) {
                    if (solved === 0) {
                        // no puzzles: just show plain text
                        streakHTML = streakText;
                    } else {
                        // Latest date: make clickable link
                        const dateOnly = streakText
                            .replace("Latest: ", "")
                            .trim();
                        const [m, d, y] = dateOnly.split("/");
                        const formattedDate = `${y}/${m.padStart(
                            2,
                            "0"
                        )}/${d.padStart(2, "0")}`;
                        const url = `https://www.nytimes.com/crosswords/game/mini/${formattedDate}`;
                        streakHTML = `<a href="${url}" target="_blank" rel="noopener noreferrer">${streakText}</a>`;
                    }
                } else {
                    // Regular streak display: include "Streak:" prefix
                    streakHTML = `Streak: ${streakText}`;
                }
                inlineStatsEl.innerHTML = `Solved: ${solved} (${pct.toFixed(
                    1
                )}%)  |  ${streakHTML}  |  Best: ${best}  |  Best Sat: ${bestSat}  |  Avg: ${avgAll}`;
            }
            // --- end inline stats ---

            // Helper to format statistics with a heading.
            function formatStats(heading, stats, count, isAllTime = false) {
                // If the heading is "Saturday Puzzles", make it bold and accent blue.
                let displayHeading = heading;
                if (heading === "Saturday Puzzles") {
                    displayHeading = `<strong class=\"saturday\">Saturday Puzzles</strong>`;
                }
                if (stats.mean === null) {
                    return `<h3>${displayHeading}</h3>
                 <ul>
                     <li>No valid puzzle times available.</li>
                 </ul>`;
                }
                // Compute custom solved line, adding total and remaining for All Puzzles
                let solvedLine = `<li>Count: ${count}</li>`;
                if (heading === "All Puzzles" && isAllTime) {
                    const remaining = totalPossiblePuzzles - count;
                    solvedLine = `<li>Count: ${count} <em>out of ${totalPossiblePuzzles} puzzles (${remaining} to go)</em></li>`;
                }
                return `<h3>${displayHeading}</h3>
            <ul>
              ${solvedLine}
              <li>Completed: ${stats.completedPercentage.toFixed(1)}%</li>
              <li>Fastest Time: ${stats.minTime.toFixed(0)} s</li>
              <li>Average/Mean: ${stats.mean.toFixed(1)} s</li>
              <li>Standard Deviation: ${stats.stdDev.toFixed(1)} s</li>
              <li>Median: ${stats.median.toFixed(0)} s</li>
              <li>Mode: ${stats.mode.toFixed(0)} s</li>
            </ul>`;
            }

            // Update Last Week statistics (row 2, first column):
            const stats7El = document.getElementById("stats7");
            if (stats7El) {
                stats7El.innerHTML =
                    formatStats(
                        "Non-Saturday Puzzles",
                        stats7Non,
                        groupNonSaturday7.filter(
                            (p) => timeToSeconds(p.time) !== null
                        ).length
                    ) +
                    formatStats(
                        "Saturday Puzzles",
                        stats7Sat,
                        groupSaturday7.filter(
                            (p) => timeToSeconds(p.time) !== null
                        ).length
                    ) +
                    formatStats(
                        "All Puzzles",
                        stats7,
                        group7.filter((p) => timeToSeconds(p.time) !== null)
                            .length
                    );
            }

            // Update Last Month statistics (row 2, second column):
            const stats30El = document.getElementById("stats30");
            if (stats30El) {
                stats30El.innerHTML =
                    formatStats(
                        "Non-Saturday Puzzles",
                        stats30Non,
                        groupNonSaturday30.filter(
                            (p) => timeToSeconds(p.time) !== null
                        ).length
                    ) +
                    formatStats(
                        "Saturday Puzzles",
                        stats30Sat,
                        groupSaturday30.filter(
                            (p) => timeToSeconds(p.time) !== null
                        ).length
                    ) +
                    formatStats(
                        "All Puzzles",
                        stats30,
                        group30.filter((p) => timeToSeconds(p.time) !== null)
                            .length
                    );
            }

            // Update Last Year statistics (row 2, third column):
            const statsSat365El = document.getElementById("statsSaturday365");
            if (statsSat365El)
                statsSat365El.innerHTML = formatStats(
                    "Non-Saturday Puzzles",
                    statsNonSaturday365,
                    groupNonSaturday365.filter(
                        (p) => timeToSeconds(p.time) !== null
                    ).length
                );
            const statsNonSat365El = document.getElementById(
                "statsNonSaturday365"
            );
            if (statsNonSat365El)
                statsNonSat365El.innerHTML = formatStats(
                    "Saturday Puzzles",
                    statsSaturday365,
                    groupSaturday365.filter(
                        (p) => timeToSeconds(p.time) !== null
                    ).length
                );
            const statsAllYearEl = document.getElementById("statsAllYear");
            if (statsAllYearEl)
                statsAllYearEl.innerHTML = formatStats(
                    "All Puzzles",
                    stats365,
                    group365.filter((p) => timeToSeconds(p.time) !== null)
                        .length
                );

            // Update All Time statistics (row 2, fourth column):
            const statsSaturdayAllEl =
                document.getElementById("statsSaturdayAll");
            if (statsSaturdayAllEl)
                statsSaturdayAllEl.innerHTML = formatStats(
                    "Non-Saturday Puzzles",
                    statsNonSaturdayAll,
                    groupNonSaturdayAll.filter(
                        (p) => timeToSeconds(p.time) !== null
                    ).length
                );
            const statsNonSatAllEl = document.getElementById(
                "statsNonSaturdayAll"
            );
            if (statsNonSatAllEl)
                statsNonSatAllEl.innerHTML = formatStats(
                    "Saturday Puzzles",
                    statsSaturdayAll,
                    groupSaturdayAll.filter(
                        (p) => timeToSeconds(p.time) !== null
                    ).length
                );
            const statsAllTimeEl = document.getElementById("statsAllTime");
            if (statsAllTimeEl)
                statsAllTimeEl.innerHTML = formatStats(
                    "All Puzzles",
                    statsOverall,
                    groupAll.filter((p) => timeToSeconds(p.time) !== null)
                        .length,
                    true
                );
        });
    }

    updateStats();

    // Listen for changes in chrome storage and update the puzzle list in realtime.
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === "local" && changes.puzzles) {
            updateFilteredPuzzleList(7, "filteredList7");
            updateFilteredPuzzleList(30, "filteredList30");
            updateFilteredPuzzleList(365, "filteredList365");
            updateFilteredPuzzleList(10000, "filteredListAll");
        }
    });
});
