# Path: backend/cognitive/fact_check.py
#
# No invented numbers.
#
# Whatever the model writes is shown only if every number in it is a number
# that was given to the model as a real figure of the run. A text containing
# any other number is discarded, never corrected or completed.

import re
from typing import List, Set

# 64   64%   0.70   0,7   +4   1.00
_NUMBER = re.compile(r"(?<![\w.,])[+-]?\d+(?:[.,]\d+)?")


def _normalise(token: str) -> float:
    return round(float(token.replace(",", ".").lstrip("+")), 6)


def numbers_in(text: str) -> List[float]:
    """All the numbers written in a text, as values (64, 0.7, ...)."""
    values = []
    for match in _NUMBER.finditer(text or ""):
        try:
            values.append(_normalise(match.group(0)))
        except ValueError:
            continue
    return values


def allowed_numbers(facts: str) -> Set[float]:
    """The numbers the model may use: those written in the facts it was given.
    A value is accepted with either sign (a gain of -5 points can be reported
    as "5 punti in meno")."""
    allowed = set()
    for value in numbers_in(facts):
        allowed.add(value)
        allowed.add(abs(value))
    return allowed


# Numbers written in words are read and checked like digits: "dodici" is fine
# if 12 is a real figure of the run, "settantadue" is not if 72 is not.
_UNIT_VALUES = {"due": 2, "tre": 3, "tré": 3, "quattro": 4, "cinque": 5, "sei": 6,
                "sette": 7, "otto": 8, "nove": 9}
_TEEN_VALUES = {"dieci": 10, "undici": 11, "dodici": 12, "tredici": 13, "quattordici": 14,
                "quindici": 15, "sedici": 16, "diciassette": 17, "diciotto": 18, "diciannove": 19}
_TENS_VALUES = {"venti": 20, "trenta": 30, "quaranta": 40, "cinquanta": 50, "sessanta": 60,
                "settanta": 70, "ottanta": 80, "novanta": 90}
_ORDINAL_VALUES = {"terzo": 3, "quarto": 4, "quinto": 5, "sesto": 6, "settimo": 7,
                   "ottavo": 8, "nono": 9, "decimo": 10}

_UNITS = r"(?:uno|una|due|tre|tré|quattro|cinque|sei|sette|otto|nove)"
_NUMBER_WORDS = re.compile(
    r"\b(?:"
    r"zero|due|tre|quattro|cinque|sette|otto|nove|dieci|undici|dodici|tredici|quattordici|quindici|sedici|"
    r"diciassette|diciotto|diciannove|"
    r"(?:venti|trenta|quaranta|cinquanta|sessanta|settanta|ottanta|novanta)" + _UNITS + r"?\w*|"
    r"(?:vent|trent|quarant|cinquant|sessant|settant|ottant|novant)(?:uno|otto|un)\w*|"
    r"cento\w*|duecento\w*|mille|"
    r"terz[oaie]|quart[oaie]|quint[oaie]|sest[oaie]|settim[oaie]|ottav[oaie]|non[oaie]|decim[oaie]|"
    r"\w+esim[oaie]"
    r")\b",
    re.IGNORECASE,
)
# "sei" is also a verb ("tu sei"): it counts as the number six only after
# words that introduce a quantity
_SEI_AS_NUMBER = re.compile(r"\b(?:a|ai|le|i|di|da|in|su|per|round|epoche|altri|altre)\s+sei\b", re.IGNORECASE)


def _cardinal(word: str):
    """Value of a cardinal number written in words (up to 100), or None."""
    if word == "zero":
        return 0
    if word == "cento":
        return 100
    for table in (_UNIT_VALUES, _TEEN_VALUES, _TENS_VALUES):
        if word in table:
            return table[word]
    for tens, value in _TENS_VALUES.items():
        if word.startswith(tens) and word[len(tens):] in _UNIT_VALUES:
            return value + _UNIT_VALUES[word[len(tens):]]
        stem = tens[:-1]                       # vent-uno, trent-otto
        if word.startswith(stem) and word[len(stem):] in ("uno", "un"):
            return value + 1
        if word.startswith(stem) and word[len(stem):] == "otto":
            return value + 8
    return None


def word_value(word: str):
    """Value of a number written in words (cardinal or ordinal), or None if it
    cannot be read with certainty."""
    word = word.lower()
    value = _cardinal(word)
    if value is not None:
        return float(value)
    masculine = word[:-1] + "o"
    if masculine in _ORDINAL_VALUES:
        return float(_ORDINAL_VALUES[masculine])
    if len(word) > 5 and word[:-1].endswith("esim"):   # undic-esimo, vent-esimo, ventun-esimo
        base = word[:-5]
        for ending in ("i", "e", "o", "a", ""):
            value = _cardinal(base + ending)
            if value is not None:
                return float(value)
    return None


def unverified_numbers(text: str, facts: str) -> List:
    """Numbers written in `text` that are not real figures given in `facts`,
    whether in digits or in words (a number in words that cannot be read with
    certainty counts as unverified). Empty = verified."""
    allowed = allowed_numbers(facts)
    found: List = [value for value in numbers_in(text) if value not in allowed and abs(value) not in allowed]
    lowered = (text or "").lower()
    for match in _NUMBER_WORDS.finditer(lowered):
        if match.group(0) == "cento" and lowered[:match.start()].rstrip().endswith("per"):
            continue  # "per cento" is the percent sign, not the number 100
        value = word_value(match.group(0))
        if value is None or value not in allowed:
            found.append(match.group(0))
    if _SEI_AS_NUMBER.search(lowered) and 6.0 not in allowed:
        found.append("sei")
    return found


def is_verified(text: str, facts: str) -> bool:
    return not unverified_numbers(text, facts)
