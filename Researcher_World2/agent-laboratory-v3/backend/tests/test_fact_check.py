"""
Tests for the rule "no invented numbers" (cognitive/fact_check.py).
"""
import os
import sys

backend_dir = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, backend_dir)

FACTS = (
    "- round completati: 12\n- accuracy: 82%\n- media ultimi 3 round: 80%; precedenti: 69%\n"
    "- rumore: 0.70\n- epoche: 5\n- pazienti anziani (over 60)\n- prossima decisione: al round 15"
)


def test_digits_must_be_real_figures():
    from cognitive import fact_check as F

    assert F.is_verified("L'accuracy globale è salita al 82% con rumore 0.70.", FACTS)
    assert F.is_verified("Rumore a 0,7 e 5 epoche, al round 12.", FACTS)       # same value, other notation
    assert F.is_verified("Nessun numero: il modello migliora grazie alla collaborazione.", FACTS)
    assert F.unverified_numbers("Siamo al 82%, quasi 85%.", FACTS) == [85.0]
    assert F.unverified_numbers("Guadagniamo 11 punti rispetto al 69%.", FACTS) == [11.0]
    assert not F.is_verified("Arriveremo al 90% entro il round 20.", FACTS)
    print("PASS: test_digits_must_be_real_figures")


def test_numbers_in_words_are_read_and_checked():
    from cognitive import fact_check as F

    for word, value in (("dodici", 12), ("settantadue", 72), ("ventuno", 21), ("trentotto", 38),
                        ("quindicesimo", 15), ("decima", 10), ("quinto", 5), ("cento", 100)):
        assert F.word_value(word) == float(value), word
    assert F.word_value("pippesimo") is None

    assert F.is_verified("Con cinque epoche locali siamo al round dodici.", FACTS)
    assert F.is_verified("Negli ultimi tre round la media è 80%.", FACTS)
    assert F.is_verified("L'ottanta per cento di media regge.", FACTS)          # "per cento" is not 100
    assert F.is_verified("Aspettiamo il quindicesimo round.", FACTS)
    assert not F.is_verified("Il rumore resta allo zero settantadue percento.", FACTS)
    assert not F.is_verified("Il cinquanta per cento non basta.", FACTS)
    assert not F.is_verified("Siamo all'ottantatré per cento.", FACTS)
    assert not F.is_verified("Tutti e due i laboratori confermano.", FACTS)      # 2 is not in the facts
    print("PASS: test_numbers_in_words_are_read_and_checked")


def test_sei_is_a_number_only_as_a_quantity():
    from cognitive import fact_check as F

    assert F.is_verified("Tu sei convinto che il modello regga?", FACTS)
    assert not F.is_verified("Portiamo le epoche a sei.", FACTS)
    assert F.is_verified("Portiamo le epoche a sei.", FACTS + "\n- epoche proposte: 6")
    print("PASS: test_sei_is_a_number_only_as_a_quantity")


if __name__ == "__main__":
    test_digits_must_be_real_figures()
    test_numbers_in_words_are_read_and_checked()
    test_sei_is_a_number_only_as_a_quantity()
