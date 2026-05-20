# CityBreakPlanner - MVP

## Główny problem
Planowanie krótkiego wyjazdu (tzw. City Break) pochłania dużo czasu i często kończy się przeglądaniem generycznych list. Brakuje narzędzia, które szybko i celnie dobierze atrakcje turystyczne ściśle dopasowane do konkretnego profilu użytkownika (kultura vs. natura), opierając się na wizualnej inspiracji.

## Najmniejszy zestaw funkcjonalności (MVP)

### Zarządzanie użytkownikiem i preferencjami
* Prosty system kont użytkowników (rejestracja i logowanie).
* Interfejs do wprowadzania preferencji dotyczących typu atrakcji turystycznych (kulturalne vs. przyrodnicze/aktywne).
* Możliwość zapisania domyślnych preferencji w koncie użytkownika.
* Dostęp do historii i przeglądania wcześniej wygenerowanych planów w panelu użytkownika.

### Silnik generujący i wyszukiwanie (AI Agents)
* Wyszukiwanie atrakcji turystycznych w wybranym mieście i jego najbliższej okolicy na podstawie wprowadzonej lokalizacji.
* Filtrowanie i dobór propozycji w oparciu o zdefiniowane preferencje (profil kulturalny lub przyrodniczy).
* Generowanie spersonalizowanego zestawienia atrakcji.

### Prezentacja wizualna (UI)
* Prezentacja wygenerowanych propozycji na interaktywnej mapie.
* Wyświetlanie przykładowego, trafnego zdjęcia dla każdej zaproponowanej atrakcji turystycznej.

## Co NIE wchodzi w zakres MVP (Out of scope)
* Wyszukiwanie propozycji noclegu.
* Wyszukiwanie propozycji restauracji i punktów gastronomicznych.
* Wyszukiwanie lotów i transportu do miasta.
* Planowanie z uwzględnieniem konkretnej daty przyjazdu (brak kalendarza).
* Planowanie dokładnej trasy dojazdu/poruszania się pomiędzy atrakcjami.
* Obliczanie i planowanie czasu zwiedzania poszczególnych miejsc (brak harmonogramu godzinowego).
* Szacowanie kosztów i budżetowanie (ceny biletów wstępu, wydatki).
* System ocen i feedbacku do wygenerowanych propozycji w celu douczania systemu.
* Sugerowanie następnego City Breaka na podstawie historii wyszukiwań.
* Tworzenie natywnych aplikacji mobilnych (projekt wyłącznie jako aplikacja webowa).

## Kryteria sukcesu
* **Kompletny przepływ:** Użytkownik potrafi założyć konto, określić swoje preferencje i wygenerować spersonalizowaną listę atrakcji dla dowolnego dużego miasta.
* **Trafność kategoryzacji:** Silnik AI poprawnie rozróżnia i filtruje atrakcje kulturalne od przyrodniczych zgodnie z wyborem użytkownika.
* **Wizualna integralność:** 100% zaproponowanych atrakcji posiada przypisane, działające zdjęcie oraz poprawne współrzędne geograficzne renderowane na mapie.
* **Brak halucynacji:** Wszystkie wygenerowane punkty odpowiadają realnie istniejącym miejscom w wybranym mieście (AI nie zmyśla atrakcji).
* **Wydajność:** Czas oczekiwania na wygenerowanie kompletnego planu przez agentów AI nie przekracza 30 sekund.