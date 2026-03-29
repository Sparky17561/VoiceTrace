<div align="center">
  <h1>🎙️ VoiceTrace</h1>
  <h3>Voice-Driven Business Operating System for Street Vendors</h3>
  <p><b>"We don’t just digitize transactions — we reconstruct business reality from imperfect human input."</b></p>
  <p><i>From ₹0 data → to daily business decisions in one tap.</i></p>
</div>

---

## 🚀 Product Summary

**VoiceTrace** is a Voice-Driven Business Operating System designed exclusively for the unorganized sector—street vendors, small shopkeepers, and non-technical micro-entrepreneurs. It transforms the traditional daily ledger into a frictionless, multilingual voice interface. Instead of typing into complex forms, users simply speak their daily activities in their native language or mixed dialects (e.g., *"30 vadapav becha, phir khatam ho gaya"*). 

> [!IMPORTANT]
> **This directly increases a vendor’s daily income by preventing lost sales and improving inventory decisions based on real market demand.**
Beyond merely recording transactions, VoiceTrace features a powerful **Counterfactual Demand Engine** that actively understands context, corrects for stockouts, estimates lost sales, and calculates true demand. It doesn't just listen; it actively advises the vendor on optimal inventory for the next day, generating PDF reports, monitoring multi-stall businesses, and tracking credit (Udhari)—all via voice.

---

## ⏱️ The 30-Second Hackathon Pitch

*"Imagine a street vendor packing up after a chaotic 12-hour shift. They don't have the energy to type out ledgers, track inventory, or calculate 7-day moving averages to predict tomorrow's stock. With VoiceTrace, they simply press a button and speak:* **'Sold 50 chai, but milk ran out by 3 PM.'** 

*Instantly, VoiceTrace logs the revenue, detects a critical stockout anomaly, estimates the missed demand based on time-of-day traffic, and updates their dashboard. The next morning, it proactively alerts them: 'Increase milk stock by 25% today to capture lost sales.' VoiceTrace is not a ledger app—it is an intelligent, multi-lingual, voice-operated business manager built for the next billion users."*

---

## 🦾 The Ask Tab (System Brain)

> [!IMPORTANT]
> **The Ask tab is not a chatbot — it is a natural language interface to the entire business system.**

Unlike traditional apps with buried menus, VoiceTrace uses the **Ask Tab** as its central nervous system. A single microphone button controls every aspect of the shop:
- **NLI Retrieval:** *"Which item was my bestseller this week?"* (Fetches DB data)
- **NLI Action:** *"Add 'Special Chai' to my menu for 15 rupees."* (Creates items)
- **NLI Ledger:** *"Log 50 rupees expense for milk."* (Updates accounting)
- **NLI Strategy:** *"What should I stock more of tomorrow?"* (Generates AI advice)

---

## 🧪 Real Example (System Thinking)

**User says:**  
*"30 vadapav becha, phir khatam ho gaya aur log maang rahe the"* (Sold 30 vadapav, then ran out and people were still asking)

**System Execution:**
1. **Logs transaction:** Records 30 units revenue.
2. **Detects stockout:** Flags the "khatam ho gaya" / "ran out" sentiment.
3. **Detects lost sales:** Identifies unmet demand from "log maang rahe the".
4. **Applies Counterfactual Demand Estimation:** Corrects the observed sales (30) to estimate true market interest.

**The "WTF" Output:**
> "You sold 30 Vadapav but ran out early.  
> **Estimated true demand was ~40–45 units.**  
> You likely lost ~150 rupees in potential profit.  
> **Recommendation:** Prepare ~25% more stock tomorrow to capture this demand."

---

## ⚠️ Real-World Robustness

**VoiceTrace is built for the chaos of the street.** Even if a vendor provides vague inputs or mixed-language slang, the system extracts value:
- **Vague Quantities:** *"Thoda bahut becha"* or *"Ek-do bacha hai"* are resolved into usable probability signals.
- **Code Switching:** Seamlessly handles switching between Hindi, Marathi, and English midpoint.
- **Background Noise:** Optimized for busy market environments with high-fidelity Whisper transcription.

---

## 🎬 Demo Flow (2-Minute Experience)

1. **Speak Transaction:** Open the 'Ask' tab and say: *"Aaj 5 samosa becha."*
2. **Show Popup:** A sleek, transparent confirmation card appears instantly with the extracted data.
3. **Confirm → Lock:** Tap 'Confirm'. The transaction is saved.
4. **Show Dashboard Insight:** Go to Dashboard; see the revenue updated and a new "System Insight" card generated.
5. **Ask Strategy:** Go back to 'Ask' and say: *"Kal kya karu?"* (What should I do tomorrow?)
| **6. System Suggestion:** System returns a specific, data-backed inventory advice based on current trends.
| **7. Final Punch:** System shows: **“You lost ₹150 yesterday — recover it today.”**

---

## 🥊 Problem Statement

Millions of micro-entrepreneurs operate entirely in the blind:
- **No Digital Records:** Typing on small screens is tedious; ledgers are either maintained in chaotic notebooks or not at all.
- **Lost Revenue due to Stockouts:** Vendors frequently under-stock fast-moving items, turning away paying customers without realizing the cumulative financial impact.
- **Unanalyzed Data:** Even if recorded, the data is sparse, messy, and lacks actionable insights. They cannot track trends or seasonal anomalies.
- **Language & Accessibility Barriers:** Existing SaaS tools demand English proficiency, small text readability, and technical literacy, alienating the actual demographic.

---

## 💡 Solution Overview

VoiceTrace solves this through a zero-friction, LLM-powered system that:
1. **Listens:** Accepts messy, conversational, multilingual input (Hindi, Marathi, Hinglish).
2. **Understands:** Extracts revenue, expenses, and fuzzy quantities using LLM reasoning.
3. **Records:** Secures the data in a confirmation-based ledger, complete with an audio audit trail.
4. **Analyzes:** Uses localized statistical models (EWMA, MAD) to detect anomalies in low-data environments.
5. **Advises:** Acts as a strategic partner, offering plain-language recommendations ("Stock more samosas tomorrow").

> [!NOTE]
> **Why Now?** With the rise of low-cost smartphones and multilingual AI models (Whisper/Llama), this is the first time such a system is actually possible for the unorganized sector.

---

## ⚡ Core Features (Deep Dive)

### 1. The Voice Ledger & Ambiguity Handling
*(`ask_service.py` & `main.py`)*
Users log activity using natural speech. If a user is vague (*"ek sau do sau ka thela lagaya"*), the AI doesn't crash; it infers approximate ranges and assigns confidence scores, turning messy real-world speech into structured financial data.

### 2. Confirmation-Based Ledger & Audio Traceability
*(`AskScreen.js`, `HistoryScreen.js`)*
Before any database write occurs, the system presents a "Ledger Card" preview. Once confirmed, the entry is permanently locked. Furthermore, every transaction is indelibly linked to its originating voice recording. A **Play Voice** button sits directly on every ledger row.

### 3. Automated PDF Report Generation
*(`pdf_service.py`)*
Built into the backend is a fully automated PDF generator (`FPDF`) that exports professional "Business Performance Reports". It compiles total revenue, expenses, net margins, and daily transaction journals into a shareable document.

### 4. Stockout & Lost Sales Detection
*(`analytics_engine.py`)*
If a vendor says, *"I sold my last 10 apples, ran out early,"* the system automatically flags a **Stockout Anomaly**. It uses time-of-day mathematics to estimate the missed demand and generates an alert.

### 5. Multi-Shop (Stall) Management
*(`ShopsScreen.js`)*
A single user can manage multiple businesses (e.g., a Chai stall and a Vadapav stall) entirely separately. The Global Header allows instant switching between business profiles.

### 6. Voice-Driven Udhari (Credit) Tracker
*(`UdhariScreen.js`)*
Vendors can create and manage digital customer tabs primarily via voice. Tracks pending balances per person and instantly updates statuses when repayments are triggered via microphone.

### 7. Deep Accessibility (I18n Localization & Scalable Fonts)
*(`translations.js`, `AppText.js`)*
The entire app UI dynamically shifts between languages and includes a global **Text-Size Scaler (A / A+ / A++)** for elderly accessibility.

---

## 🌟 Unique Selling Points (USPs)

> [!IMPORTANT]
> **Counterfactual Demand Estimation (The Core USP)**
> Unlike standard ledgers that only track what *was* sold, VoiceTrace mathematically estimates **what COULD have been sold**. By correcting for stockout events using the `analytics_engine.py`, it reveals hidden, unmet demand.

> [!TIP]
> **The Trust Layer: Tamper-Resistant Records**
> Unlike traditional apps, every entry in VoiceTrace is **voice-backed, timestamped, and locked** after confirmation. This creates a high-integrity audit trail that makes the data bank-ready for micro-loans.

- **Handles Pure Uncertainty:** It embraces human vagueness rather than throwing validation errors.
- **Voice as a True OS:** No forms, no typing. If you can talk, you can run a business.
- **Explainable Intelligence:** Recommendations tell you *why* based on your own data.

---

## 🛠️ Technical Architecture & Analytics

- **Frontend:** React Native (Expo) - "Aura" midnight-blue design system.
- **Backend:** FastAPI (Python)
- **Database:** SQLite (Postgres-ready SQLAlchemy ORM)
- **AI Engine:** Groq Cloud (`Whisper-large-v3-turbo` + `Llama-3.1-8B`).

### Why Hybrid Analytics over Traditional ML?
Deep learning models fail in environments with sparse data (4–7 days of history). Instead, VoiceTrace employs:
- **EWMA (Exponentially Weighted Moving Average):** Detects momentum and short-term trends.
- **MAD (Median Absolute Deviation):** Flags extreme financial anomalies without outlier skewing.

---

## 🥊 Competitor Differentiation

| traditional Ledger Apps (Khatabook, OkCredit) | VoiceTrace |
| :--- | :--- |
| Require manual typing and categories | Handles messy, real-world speech |
| Records historical data only | Predicts counterfactual demand and future stock needs. |
| Blind to inventory stockouts | Actively detects 'ran out' events and calculates lost sales. |

---

## 🔮 Future Scope

**From Ledger to Fintech Powerhouse:** With consistent, voice-verified data history, VoiceTrace can integrate directly with micro-lending institutions, enabling instant, data-backed loan approvals for vendors who were previously "unbankable."

---

## 🎯 Impact & Conclusion

**VoiceTrace** bridges the extreme digital divide. It takes cutting-edge Generative AI and packages it into an interface so simple that a street vendor with an analog mindset can master it in 30 seconds. By eradicating data-entry friction and surfacing mathematically sound, counterfactual inventory advice, VoiceTrace guarantees that micro-entrepreneurs never leave money on the table again. 

It upgrades informal street commerce into data-driven micro-enterprises.

**"We don’t just record transactions — we help vendors make better decisions every day."**
