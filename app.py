import json
import os

from anthropic import Anthropic
from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request

load_dotenv()

app = Flask(__name__)
client = Anthropic()

SYSTEM_PROMPT = """You are a senior QuickBooks customer support specialist. You will receive a transcript of what a customer said during a support call.

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

Return ONLY valid JSON. No markdown fences. No extra text."""


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/process", methods=["POST"])
def process():
    data = request.get_json()
    transcript = data.get("transcript", "").strip()

    if not transcript:
        return jsonify({"error": "No transcript provided"}), 400

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[
            {"role": "user", "content": f"Customer transcript:\n\n{transcript}"}
        ],
    )

    try:
        result = json.loads(message.content[0].text)
    except json.JSONDecodeError:
        result = {
            "summary": "Could not parse structured response.",
            "response": message.content[0].text,
        }

    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True, port=5000)
