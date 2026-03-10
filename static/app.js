const recordBtn = document.getElementById("recordBtn");
const stopBtn = document.getElementById("stopBtn");
const processBtn = document.getElementById("processBtn");
const status = document.getElementById("status");
const transcript = document.getElementById("transcript");
const resultsPanel = document.getElementById("resultsPanel");
const summaryDiv = document.getElementById("summary");
const responseDiv = document.getElementById("response");

let recognition = null;

// Feature detection for Web Speech API
if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
    status.textContent = "Speech recognition not supported. Use Chrome, or type below.";
    recordBtn.disabled = true;
}

// Enable Process button when user types in the textarea
transcript.addEventListener("input", function () {
    if (!recognition) {
        processBtn.disabled = transcript.value.trim().length === 0;
    }
});

function createRecognition() {
    const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = function (event) {
        let finalText = "";
        let interimText = "";
        for (let i = 0; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
                finalText += event.results[i][0].transcript + " ";
            } else {
                interimText += event.results[i][0].transcript;
            }
        }
        transcript.value = finalText + interimText;
    };

    rec.onerror = function (event) {
        status.textContent = "Error: " + event.error;
    };

    rec.onend = function () {
        status.textContent = "Stopped";
        recordBtn.disabled = false;
        stopBtn.disabled = true;
        processBtn.disabled = transcript.value.trim().length === 0;
        recognition = null;
    };

    return rec;
}

recordBtn.addEventListener("click", function () {
    transcript.value = "";
    resultsPanel.style.display = "none";
    recognition = createRecognition();
    recognition.start();
    status.textContent = "Listening...";
    recordBtn.disabled = true;
    stopBtn.disabled = false;
    processBtn.disabled = true;
});

stopBtn.addEventListener("click", function () {
    if (recognition) {
        recognition.stop();
    }
});

processBtn.addEventListener("click", async function () {
    const text = transcript.value.trim();
    if (!text) return;

    processBtn.disabled = true;
    recordBtn.disabled = true;
    status.textContent = "Processing...";

    try {
        const res = await fetch("/process", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transcript: text }),
        });

        const data = await res.json();

        if (data.error) {
            status.textContent = "Error: " + data.error;
            return;
        }

        summaryDiv.textContent = data.summary;
        responseDiv.textContent = data.response;
        resultsPanel.style.display = "block";
        status.textContent = "Done";
    } catch (err) {
        status.textContent = "Request failed: " + err.message;
    } finally {
        processBtn.disabled = false;
        recordBtn.disabled = false;
    }
});
