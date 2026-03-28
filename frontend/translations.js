import * as Localization from 'expo-localization';
import { I18n } from 'i18n-js';

const translations = {
  en: {
    welcome: "Welcome",
    today: "Today",
    dashboard: "Dashboard",
    recorder: "Recorder",
    history: "History",
    auditHistory: "Audit History",
    shops: "My Shops",
    stalls: "Stalls",
    speak: "Speak about your business...",
    listening: "Listening...",
    processing: "Processing...",
    tapToStart: "Tap to start recording",
    playVoice: "Play Voice",
    edit: "Edit",
    exportPdf: "Export PDF",
    logout: "Sign out",
    noRecords: "No past records found.",
    revenue: "Revenue",
    expense: "Expense",
    net_profit: "Net Profit",
    ledger: "Ledger",
  },
  hi: {
    welcome: "स्वागत है",
    today: "आज",
    dashboard: "डैशबोर्ड",
    recorder: "रिकॉर्डर",
    history: "इतिहास",
    auditHistory: "ऑडिट इतिहास",
    shops: "मेरी दुकानें",
    stalls: "दुकानें",
    speak: "अपने व्यवसाय के बारे में बोलें...",
    listening: "सुन रहे हैं...",
    processing: "प्रोसेस हो रहा है...",
    tapToStart: "रिकॉर्डिंग शुरू करने के लिए टैप करें",
    playVoice: "आवाज चलाएं",
    edit: "बदलें",
    exportPdf: "PDF निकालें",
    logout: "बाहर निकलें",
    noRecords: "कोई रिकॉर्ड नहीं मिला।",
    revenue: "कमाई",
    expense: "खर्चा",
    net_profit: "कुल मुनाफ़ा",
    ledger: "बहीखाता",
  },
  mr: {
    welcome: "स्वागत आहे",
    today: "आज",
    dashboard: "डॅशबोर्ड",
    recorder: "रेकॉर्डर",
    history: "इतिहास",
    auditHistory: "ऑडिट इतिहास",
    shops: "माझ्या दुकाने",
    stalls: "स्टॉल्स",
    speak: "तुमच्या व्यवसायाबद्दल बोला...",
    listening: "ऐकत आहे...",
    processing: "प्रक्रिया सुरू आहे...",
    tapToStart: "रेकॉर्डिंग सुरू करण्यासाठी टॅप करा",
    playVoice: "आवाज ऐका",
    edit: "दुरुस्त करा",
    exportPdf: "PDF डाउनलोड करा",
    logout: "बाहर पडा",
    noRecords: "कोणताही रेकॉर्ड सापडला नाही.",
    revenue: "उत्पन्न",
    expense: "खर्च",
    net_profit: "निव्वळ नफा",
    ledger: "खतावणी",
  }
};

const i18n = new I18n(translations);
i18n.enableFallback = true;
i18n.locale = (
  Localization.locale ||
  (Localization.getLocales && Localization.getLocales()[0]?.languageCode) ||
  'en'
).split('-')[0];

export default i18n;