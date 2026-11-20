# Projekty i zadania

Jednostronicowa aplikacja Power Apps Code App (React, TypeScript, Vite).

## Uruchomienie

W katalogu projektu, po zalogowaniu CLI do odpowiedniego środowiska:

```powershell
pa app run
```

Otwórz adres lokalnego odtwarzacza podany przez CLI. Odtwarzacz udostępnia kontekst
Dataverse; sam podgląd Vite nie wystarcza do testowania danych.

```powershell
npm run build
npm test
npx eslint src/App.tsx src/components src/config src/data
```

`npm test` sprawdza reguły i payloady zapisu na atrapach SDK, nie tworzy rekordów
w Dataverse. Test rzeczywistego zapisu wymaga zalogowania odtwarzacza Power Apps.

## Dane i reguły

- Projekty: `dredz_project1` / `dredz_project1s`, serwis `Dredz_project1sService`.
- Zadania: `dredz_task1` / `dredz_task1s`, serwis `Dredz_task1sService`.
- Listy wyboru: `dredz_clients`, `dredz_products`, `dredz_personusers`,
  `transactioncurrencies`. Stare tabele `dredz_project` i `dredz_task` nie są używane.
- Nazwy zbiorów, nawigacji lookupów oraz polskie etykiety Choice są w
  [src/config/dataverse.ts](src/config/dataverse.ts). Wartości opcji pochodzą z modeli.
- Cały dostęp do danych jest w [src/data/projects.ts](src/data/projects.ts).
  Odczyty używają `select`, filtra aktywności i stronicowania.
- Lista główna wyklucza etapy Completed i Lost. Zadania są pobierane dla wybranego projektu.
- Klient jest wymagany tylko dla rodzaju Klient. Dla projektu wewnętrznego bind klienta
  jest pomijany. Projekt zadania jest zawsze wymagany.
- Osoby są wybierane z PersonUser (`dredz_name`, `dredz_email`), nie z systemowego Owner.
- Pola formularzy używają prefiksu `dredz_pm_`; identyfikatory to
  `dredz_project1id` i `dredz_task1id`.
- Lookupi projektu: `dredz_pm_clientid`, `dredz_pm_productid`, `dredz_pm_owner`,
  `transactioncurrencyid`. Lookupi zadania: `dredz_pm_projectid`, `dredz_pm_owner`,
  `dredz_pm_requestedby`. Zapis używa `@odata.bind`.
- Wartość i waluta są opcjonalne (sekcja „Więcej pól”). Podanie wartości wymaga wyboru
  waluty, bez wartości bind waluty nie jest wysyłany. Aplikacja nie ustawia domyślnej waluty.
- Utworzenie zadania aktualizuje `dredz_pm_lastactivity` projektu na lokalną dzisiejszą datę.
  Są to dwa zapisy. Jeśli drugi zawiedzie, aplikacja pokazuje błąd i pozwala ponowić
  wyłącznie aktualizację daty, bez tworzenia duplikatu zadania.
- Listy wyboru zawierają tylko aktywne rekordy; istniejące powiązanie z rekordem spoza
  listy jest wyraźnie oznaczone.

Nie edytuj plików w `src/generated`. Wyjątkiem uzgodnionym dla tego wdrożenia było
usunięcie nieaktualnych wpisów `dredz_projects` i `dredz_tasks` z
`.power/schemas/appschemas/dataSourcesInfo.ts`.
