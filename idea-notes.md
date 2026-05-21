# CartoCards / Map Flashcards / Geo Flashcards / MeridianMind - MVP

## Główny problem
Nauka lokalizacji obiektów geograficznych, historycznych czy topograficznych (np. stolice państw, pasma górskie, zabytki) przy użyciu tradycyjnych metod tekstowych lub papierowych map jest mało efektywna i monotonna. Brakuje interaktywnego narzędzia, które weryfikuje wiedzę przestrzenną użytkownika i pozwala mu na naukę poprzez bezpośrednie wskazywanie punktów na cyfrowej mapie, z wykorzystaniem techniki powtórek rozłożonych w czasie (Spaced Repetition).

## Najmniejszy zestaw funkcjonalności (MVP)

### 1. Zarządzanie bazą fiszek przestrzennych (CRUD & Import)
* **Masowy import danych:** Możliwość szybkiego zaimportowania gotowego zestawu fiszek z pliku tekstowego w formacie CSV (struktura kolumn: `nazwa_obiektu`, `szerokość_geograficzna`, `długość_geograficzna`).
* **Manualny kreator:** Panel do ręcznego dodawania pojedynczych fiszek poprzez wpisanie nazwy oraz koordynatów GPS (lub opcjonalnie kliknięcie punktu na mapie podczas tworzenia).
* **Zarządzanie zestawami:** Możliwość przeglądania, edycji zawartości oraz usuwania stworzonych zestawów fiszek.

### 2. Moduł Nauki i Odpytywania (Core Engine)
* **Sesja Quizu:** Aplikacja wyświetla losową lub zaplanowaną nazwę obiektu z zestawu, a zadaniem użytkownika jest kliknięcie w odpowiednie miejsce na interaktywnej mapie.
* **Weryfikacja przestrzennna:** System sprawdza odległość kliknięcia użytkownika od faktycznych współrzędnych obiektu, oblicza błąd (np. w kilometrach lub metrach) i wyświetla informację zwrotną (np. zielony marker sukcesu lub czerwony wskazujący poprawną lokalizację wraz z linią błędu).
* **Integracja z algorytmem powtórek:** Wykorzystanie gotowego, prostego silnika powtórek (np. klasycznego systemu pudełkowego Leitnera), który decyduje o częstotliwości pojawiania się danej fiszki na podstawie precyzji kliknięć użytkownika.

### 3. System Kont i Trwałość Danych
* **Prosty moduł użytkownika:** Rejestracja, logowanie i uwierzytelnianie (konto lokalne).
* **Zapisywanie progresu:** Przechowywanie zestawów fiszek oraz indywidualnego stanu algorytmu powtórek w bazie danych, uniemożliwiające utratę postępów po wylogowaniu.

## Proponowana rola dla Agentów AI (Kontekst kursu)
Mimo wyłączenia automatycznego generowania bazy danych z MVP, Agenty AI mogą pełnić kluczowe funkcje wspierające:
* **Agent Ewaluacji (Tutor):** Analizuje dokładność kliknięcia użytkownika i generuje spersonalizowaną, tekstową informację zwrotną (np. *"Świetnie! Pomyliłeś się tylko o 12 km, szukaj odrobinę bardziej na zachód"*).
* **Agent Dynamicznego Harmonogramu:** Analizuje krzywą zapominania użytkownika i optymalizuje kolejność wyświetlania obiektów przestrzennych w ramach zintegrowanego algorytmu SRS.

## Co NIE wchodzi w zakres MVP (Out of scope)
* **Generowanie fiszek przez AI:** Automatyczne tworzenie całych zestawów przez LLM na podstawie promptu (np. "Stwórz zestaw: zamki w Polsce").
* **Autorski, zaawansowany algorytm SRS:** Budowanie od zera skomplikowanych silników matematycznych na wzór SuperMemo czy zaawansowanego algorytmu SM-2 (stosujemy gotowe, proste biblioteki lub reguły).
* **Funkcje społecznościowe:** Udostępnianie zestawów innym użytkownikom, publiczne biblioteki fiszek, rankingi i wspólna nauka.
* **Aplikacje mobilne:** Budowa natywnych aplikacji na systemy Android/iOS (na potrzeby MVP powstaje wyłącznie aplikacja webowa RWD).

## Kryteria sukcesu
* **Szybki proces importu:** Bezproblemowe i poprawne sparsowanie pliku CSV zawierającego min. 50 lokalizacji oraz automatyczne uruchomienie sesji nauki w czasie poniżej 3 sekund.
* **Dokładność geolokacyjna:** Prawidłowe mapowanie współrzędnych GPS z bazy danych na interaktywne punkty na mapie (brak przesunięć spowodowanych błędami renderowania).
* **Natychmiastowy feedback:** Wyświetlenie graficznego podsumowania próby (odległość, poprawność) w czasie krótszym niż 500 ms od kliknięcia użytkownika na mapie.
* **Działająca pętla powtórek:** Fiszki wskazywane błędnie wracają do puli pytań w tej samej sesji lub są planowane na kolejny dzień, zgodnie z założeniami wybranego algorytmu.
