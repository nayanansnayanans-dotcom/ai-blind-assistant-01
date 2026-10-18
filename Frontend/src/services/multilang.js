// Frontend/src/services/multilang.js - Global Multi-Language API & Translation Engine

export const SUPPORTED_LANGUAGES = [
  { code: 'en-US', short: 'en', name: 'English', nativeName: 'English (US)', flag: '🇬🇧', speechLang: 'en-US' }
];

export function getStoredLanguage() {
  try {
    const saved = localStorage.getItem('selected_language');
    if (saved) return saved;
  } catch (e) {}
  return 'en-US';
}

export function getStoredLanguageObj() {
  const code = getStoredLanguage();
  return SUPPORTED_LANGUAGES.find(l => l.code === code) || SUPPORTED_LANGUAGES[0];
}

export function setStoredLanguage(langCode) {
  try {
    localStorage.setItem('selected_language', langCode);
    window.dispatchEvent(new CustomEvent('language_changed', { detail: { langCode } }));
    window.dispatchEvent(new Event('storage'));
  } catch (e) {}
}

export function getLanguageSwitchGreeting(langCode) {
  switch (langCode) {
    case 'hi-IN':
      return "भाषा बदलकर हिंदी कर दी गई है। आपका एआई वॉयस असिस्टेंट अब हिंदी में बोलेगा और सुनेगा।";
    case 'ta-IN':
      return "மொழி தமிழுக்கு மாற்றப்பட்டது. குரல் உதவியாளர் இப்போது தமிழில் பேசும் மற்றும் கேட்கும்.";
    case 'te-IN':
      return "భాష తెలుగుకి మార్చబడింది. వాయిస్ అసిస్టెంట్ ఇప్పుడు తెలుగులో మాట్లాడుతుంది మరియు వింటుంది.";
    case 'kn-IN':
      return "ಭಾಷೆಯನ್ನು ಕನ್ನಡಕ್ಕೆ ಬದಲಾಯಿಸಲಾಗಿದೆ. ಧ್ವನಿ ಸಹಾಯಕ ಈಗ ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡುತ್ತದೆ ಮತ್ತು ಕೇಳುತ್ತದೆ.";
    case 'ml-IN':
      return "ഭാഷ മലയാളത്തിലേക്ക് മാറ്റി. വോയ്സ് അസിസ്റ്റന്റ് ഇനി മലയാളത്തിൽ സംസാരിക്കുകയും കേൾക്കുകയും ചെയ്യും.";
    case 'bn-IN':
      return "ভাষা বাংলায় পরিবর্তিত হয়েছে। ভয়েস অ্যাসিস্ট্যান্ট এখন বাংলায় কথা বলবে এবং শুনবে।";
    case 'mr-IN':
      return "भाषा बदलून मराठी करण्यात आली आहे. व्हॉईस असिस्टंट आता मराठीत बोलेल आणि ऐकेल.";
    case 'gu-IN':
      return "ભાષા બદલીને ગુજરાતી કરવામાં આવી છે. વોઇસ આસિસ્ટન્ટ હવે ગુજરાતીમાં બોલશે અને સાંભળશે.";
    case 'es-ES':
      return "Idioma cambiado a español. El asistente de voz ahora hablará y escuchará en español.";
    case 'fr-FR':
      return "Langue changée en français. L'assistant vocal parlera et écoutera désormais en français.";
    case 'de-DE':
      return "Sprache auf Deutsch geändert. Der Sprachassistent spricht und hört jetzt auf Deutsch.";
    default:
      return "Language changed to English. VisionAssist voice assistant will now speak and listen in English.";
  }
}

// Built-in Dictionary Translations for Core UI Elements
const UI_DICTIONARY = {
  'Dashboard': {
    'hi-IN': 'डैशबोर्ड', 'ta-IN': 'டாஷ்போர்டு', 'te-IN': 'డాష్‌బోర్డ్', 'kn-IN': 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್',
    'ml-IN': 'ഡാഷ്‌ബോർഡ്', 'bn-IN': 'ড্যাশবোর্ড', 'mr-IN': 'डॅशबोर्ड', 'gu-IN': 'ડેશબોર્ડ',
    'es-ES': 'Panel de Control', 'fr-FR': 'Tableau de bord', 'de-DE': 'Dashboard'
  },
  'AI Exam Assistant': {
    'hi-IN': 'एआई परीक्षा सहायक', 'ta-IN': 'AI தேர்வு உதவியாளர்', 'te-IN': 'AI పరీక్ష సహాయకుడు',
    'kn-IN': 'AI ಪರೀಕ್ಷಾ ಸಹಾಯಕ', 'ml-IN': 'AI പരീക്ഷാ സഹായി', 'bn-IN': 'এআই পরীক্ষা সহকারী',
    'mr-IN': 'एआय परीक्षा सहाय्यक', 'gu-IN': 'એઆઈ પરીક્ષા સહાયક', 'es-ES': 'Asistente de Examen AI',
    'fr-FR': 'Assistant d Examen IA', 'de-DE': 'KI Prüfungsassistent'
  },
  'Start Exam': {
    'hi-IN': 'परीक्षा शुरू करें', 'ta-IN': 'தேர்வை தொடங்குங்கள்', 'te-IN': 'పరీక్షను ప్రారంభించండి',
    'kn-IN': 'ಪರೀಕ್ಷೆಯನ್ನು ಪ್ರಾರಂಭಿಸಿ', 'ml-IN': 'പരീക്ഷ ആരംഭിക്കുക', 'bn-IN': 'পরীক্ষা শুরু করুন',
    'mr-IN': 'परीक्षा सुरू करा', 'gu-IN': 'પરીક્ષા શરૂ કરો', 'es-ES': 'Iniciar Examen',
    'fr-FR': 'Commencer l Examen', 'de-DE': 'Prüfung starten'
  },
  'Voice Assistant Active & Listening!': {
    'hi-IN': 'वॉयस असिस्टेंट सक्रिय है और सुन रहा है!', 'ta-IN': 'குரல் உதவியாளர் செயல்படுகிறது மற்றும் கேட்கிறது!',
    'te-IN': 'వాయిస్ అసిస్టెంట్ సక్రియంగా ఉంది మరియు వింటోంది!', 'kn-IN': 'ಧ್ವನಿ ಸಹಾಯಕ ಸಕ್ರಿಯವಾಗಿದೆ ಮತ್ತು ಕೇಳುತ್ತಿದೆ!',
    'ml-IN': 'വോയ്സ് അസിസ്റ്റന്റ് സജീവമാണ്, കേൾക്കുന്നു!', 'bn-IN': 'ভয়েস অ্যাসিস্ট্যান্ট সক্রিয় এবং শুনছে!',
    'mr-IN': 'व्हॉईस असिस्टंट सक्रिय आहे आणि ऐकत आहे!', 'gu-IN': 'વોઇસ આસિસ્ટન્ટ સક્રિય છે અને સાંભળી રહ્યો છે!',
    'es-ES': '¡Asistente de voz activo y escuchando!', 'fr-FR': 'Assistant vocal actif et à l écoute!',
    'de-DE': 'Sprachassistent aktiv und hört zu!'
  }
};

export function translatePhrase(phraseKey, targetLang = null) {
  const lang = targetLang || getStoredLanguage();
  if (lang === 'en-US' || !phraseKey) return phraseKey;
  if (UI_DICTIONARY[phraseKey] && UI_DICTIONARY[phraseKey][lang]) {
    return UI_DICTIONARY[phraseKey][lang];
  }
  return phraseKey;
}

// Online Auto-Translation Service
export async function fetchOnlineTranslation(text, targetLangCode = null) {
  const langCode = targetLangCode || getStoredLanguage();
  if (!text || langCode === 'en-US' || langCode === 'en') return text;

  const targetShort = langCode.split('-')[0];

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetShort}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data && data.responseData && data.responseData.translatedText) {
      return data.responseData.translatedText;
    }
  } catch (err) {
    console.warn('Online Translation API fallback error:', err);
  }
  return text;
}
