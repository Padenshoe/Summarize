const recordBtn = document.getElementById("recordBtn");
const stopBtn = document.getElementById("stopBtn");
const processBtn = document.getElementById("processBtn");
const statusEl = document.getElementById("status");
const transcript = document.getElementById("transcript");
const resultsPanel = document.getElementById("resultsPanel");
const summaryDiv = document.getElementById("summary");
const responseDiv = document.getElementById("response");
const apiKeyInput = document.getElementById("apiKey");
const toggleKeyBtn = document.getElementById("toggleKey");
const saveKeyBtn = document.getElementById("saveKey");
const keyStatus = document.getElementById("keyStatus");

let recognition = null;

// --- API Key Management ---

const savedKey = localStorage.getItem("anthropic_api_key");
if (savedKey) {
    apiKeyInput.value = savedKey;
    keyStatus.textContent = "Key loaded from saved data.";
}

toggleKeyBtn.addEventListener("click", function () {
    if (apiKeyInput.type === "password") {
        apiKeyInput.type = "text";
        toggleKeyBtn.textContent = "Hide";
    } else {
        apiKeyInput.type = "password";
        toggleKeyBtn.textContent = "Show";
    }
});

saveKeyBtn.addEventListener("click", function () {
    const key = apiKeyInput.value.trim();
    if (key) {
        localStorage.setItem("anthropic_api_key", key);
        keyStatus.textContent = "Key saved.";
    } else {
        keyStatus.textContent = "Please enter a key first.";
    }
});

function getApiKey() {
    return apiKeyInput.value.trim();
}

// --- Speech Recognition ---

if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
    statusEl.textContent =
        "Speech recognition not supported. Use Chrome, or type below.";
    recordBtn.disabled = true;
}

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
        statusEl.textContent = "Error: " + event.error;
    };

    rec.onend = function () {
        statusEl.textContent = "Stopped";
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
    statusEl.textContent = "Listening...";
    recordBtn.disabled = true;
    stopBtn.disabled = false;
    processBtn.disabled = true;
});

stopBtn.addEventListener("click", function () {
    if (recognition) {
        recognition.stop();
    }
});

// --- Claude API Call ---

const SYSTEM_PROMPT = `You are a senior QuickBooks customer support specialist. You will receive a transcript of what a customer said during a support call.

You must return a JSON object with exactly two keys:
1. "summary" - A concise 1-3 sentence summary of the customer's issue.
2. "response" - A sympathetic, helpful response that:
   - Opens with empathy (acknowledge their frustration or confusion)
   - Provides specific, step-by-step QuickBooks navigation instructions
   - Uses exact UI element names (e.g., "gear icon in the top-right corner", "Chart of Accounts", "Banking tab on the left sidebar")
   - References QuickBooks Online menu paths like: Settings > Chart of Accounts > New
   - Ends with a follow-up offer

QuickBooks knowledge you must use when relevant:
- Navigation: Gear icon (top-right) for settings, Plus icon (+) for creating transactions, Left sidebar for reports/banking/sales/expenses
- Common paths:
  - Chart of Accounts: Gear icon > Chart of Accounts
  - Reconciliation: Banking (left sidebar) > Reconcile
  - Invoice creation: + New > Invoice
  - Customer management: Sales > Customers
  - Bank connections: Banking (left sidebar) > Link account
  - Reports: Reports (left sidebar) > search or browse by category
  - Payroll: Payroll (left sidebar) > Employees > Run payroll
  - Sales tax: Taxes (left sidebar) > Sales Tax
  - Vendor management: Expenses > Vendors
  - Bill payment: + New > Pay Bills
  - Journal entries: + New > Journal Entry
  - Profit & Loss: Reports > Profit and Loss
  - Balance Sheet: Reports > Balance Sheet
  - Accounts receivable aging: Reports > Accounts receivable aging summary
  - Bank rules: Banking (left sidebar) > Bank rules
  - Recurring transactions: Gear icon > Recurring Transactions
  - Classes/Locations: Gear icon > Account and Settings > Advanced > Categories
- Common issues: bank feed disconnections, reconciliation discrepancies, duplicate transactions, invoice payment matching, class/location tracking, journal entries, profit & loss vs balance sheet questions

Return ONLY valid JSON. No markdown fences. No extra text.`;

processBtn.addEventListener("click", async function () {
    const text = transcript.value.trim();
    if (!text) return;

    const apiKey = getApiKey();
    if (!apiKey) {
        statusEl.textContent = "Please enter your Anthropic API key above.";
        return;
    }

    processBtn.disabled = true;
    recordBtn.disabled = true;
    statusEl.textContent = "Processing...";

    try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "anthropic-dangerous-direct-browser-access": "true",
            },
            body: JSON.stringify({
                model: "claude-sonnet-4-20250514",
                max_tokens: 1024,
                system: SYSTEM_PROMPT,
                messages: [
                    {
                        role: "user",
                        content:
                            "Customer transcript:\n\n" + text,
                    },
                ],
            }),
        });

        if (!res.ok) {
            const err = await res.json();
            statusEl.textContent =
                "API Error: " + (err.error?.message || res.statusText);
            return;
        }

        const apiResponse = await res.json();
        const rawText = apiResponse.content[0].text;

        let data;
        try {
            data = JSON.parse(rawText);
        } catch (e) {
            data = {
                summary: "Could not parse structured response.",
                response: rawText,
            };
        }

        summaryDiv.textContent = data.summary;
        responseDiv.textContent = data.response;
        resultsPanel.style.display = "block";
        statusEl.textContent = "Done";
    } catch (err) {
        statusEl.textContent = "Request failed: " + err.message;
    } finally {
        processBtn.disabled = false;
        recordBtn.disabled = false;
    }
});
