"""The language a quote is written in, so a translated verse can be compared with the approved translation in it.

Arabic-script Urdu is told apart from Arabic by letters Arabic does not use; Latin-script languages by their most
common short words. Returns None when unsure: the caller then falls back to the meaning check.
"""

import re

from .align import is_arabic

# Letters used in Urdu but not in Arabic (ٹ ڈ ڑ ں ے ۓ ھ ہ).
_URDU = re.compile(r"[ٹڈڑںےۓھہ]")

_STOPWORDS = {
    "en": "the and of to is in that you he who not for with his they be are will your their them",
    "fr": "le la les et des du est une un qui que pas pour dans ne vous il sur au ce leur ils",
    "es": "el la los las y de que en es una por para no se del su al con lo sus",
    "de": "der die das und ist nicht zu den mit sie ein eine wer es auf dem auch ihr euch",
    "id": "dan yang di ke dari ini itu tidak dengan untuk kamu mereka adalah akan pada kami",
    "tr": "ve bir bu için ile de da ne değil onlar size siz olan gibi kim onu",
}
_WORDS = {lang: set(words.split()) for lang, words in _STOPWORDS.items()}


def detect_language(text: str) -> str | None:
    if len(_URDU.findall(text)) >= 2:
        return "ur"
    if is_arabic(text):
        return "ar"
    tokens = re.findall(r"[^\W\d_]+", text.lower())
    scores = {lang: sum(t in words for t in tokens) for lang, words in _WORDS.items()}
    best = max(scores, key=scores.get)
    ranked = sorted(scores.values(), reverse=True)
    return best if ranked[0] >= 2 and ranked[0] > ranked[1] else None


# The approved QuranEnc translation loaded for each language (scripts/load_translations.py).
TRANSLATION_LABELS = {
    "en": "موسوعة القرآن الكريم، الترجمة الإنجليزية (صحيح إنترناشونال)",
    "fr": "موسوعة القرآن الكريم، الترجمة الفرنسية (رشيد معاش)",
    "es": "موسوعة القرآن الكريم، الترجمة الإسبانية (عيسى غارسيا)",
    "de": "موسوعة القرآن الكريم، الترجمة الألمانية (فرانك بوبنهايم)",
    "id": "موسوعة القرآن الكريم، الترجمة الإندونيسية (وزارة الشؤون الدينية)",
    "tr": "موسوعة القرآن الكريم، الترجمة التركية (مركز رواد الترجمة)",
    "ur": "موسوعة القرآن الكريم، الترجمة الأردية (محمد جوناكري)",
}
