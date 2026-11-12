# Pracovní výkazy — Netlify Free + Turso Free

Samostatný web bez ChatGPT a bez Cloudflare. Tato verze je připravená a místně otestovaná, ale zatím není nasazená do skutečných účtů Netlify/Turso. Původní web na chatgpt.site zůstává beze změny. Skutečná docházka se automaticky nepřenáší.

## Co zůstává
Přihlášení zaměstnanců PINem na aktivovaném zařízení, správcovský účet, účetní, firmy včetně ANEST s.r.o., pracoviště CJCH/Anest/Gmed/Trnová/Hvězda, zpětný i hromadný zápis dní, absence, fond a saldo, odevzdání a uzamčení, CSV a ZIP, importní TXT pro PREMIER.

## Bezplatný provoz
Vyberte pouze Free u Netlify i Turso. Nezapínejte placený tarif, automatické dobíjení ani placené překročení limitů. Netlify Free dovoluje firemní projekty a po vyčerpání měsíčních kreditů aplikaci pozastaví do dalšího období. Turso má bezplatný tarif bez platební karty. Bezplatné limity nejsou zárukou nepřetržitého provozu pro libovolný počet zaměstnanců; sledujte využití. Vlastní doménu není nutné kupovat — pro začátek lze použít adresu netlify.app přidělenou při nasazení.
Ověřené zdroje 11. 11. 2026: https://www.netlify.com/blog/introducing-netlify-free-plan/ ; https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/billing-faq-for-credit-based-plans/ ; https://turso.tech/pricing

## Spuštění — kroky pro správce
1. Založit účet na https://app.netlify.com/ a https://turso.tech/ — pouze bezplatné tarify. Pro tento projekt zvolit databázi typu **libSQL**, kterou obsluhuje @libsql/client, nikoli nový nekompatibilní typ databáze. Zvolit vhodný evropský region, pokud jej bezplatný tarif nabízí.
2. V Turso vytvořit databázi `cjc-vykazy`, získat její URL a databázový přístupový token. Hodnoty patří do soukromého nastavení, nikoli do chatu nebo zdrojových souborů.
3. Na počítači s Node.js 24 rozbalit tento projekt, spustit `npm ci` a `npm run init:local`. Vytvoří se soukromý soubor `.env` se dvěma náhodnými klíči. V něm nahradit lokální TURSO_DATABASE_URL skutečnou URL a doplnit TURSO_AUTH_TOKEN. Zachovat AUTH_SECRET a SETUP_TOKEN. Spustit `npm run db:migrate` — založí tabulky, další spuštění již použité migrace přeskočí.
4. Projekt vložit do soukromého Git repozitáře (bez .env, databáze a záloh), v Netlify vybrat import projektu z tohoto repozitáře. Připravený netlify.toml nastavuje build i serverové funkce. Prosté přetažení složky dist do Netlify Drop nestačí: nenahraje serverovou část.
5. V Netlify před prvním nasazením nastavit pro serverové funkce čtyři proměnné: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, AUTH_SECRET, SETUP_TOKEN. Žádná nesmí začínat VITE_. Klíče nejsou součástí balíčku. Nasadit projekt s Node.js 24. Po změně proměnných znovu nasadit.
6. Otevřít skutečnou adresu přidělenou Netlify. Zadáním instalačního klíče SETUP_TOKEN vytvořit prvního správce s vlastním heslem. Potom odstranit SETUP_TOKEN z Netlify a znovu nasadit. AUTH_SECRET zachovat a soukromě zálohovat — změna zneplatní PINy.
7. Přidat testovacího zaměstnance a účetní, ověřit aktivaci zařízení, přihlášení, uložení, odevzdání a export. Teprve poté zadat skutečné profily a rozhodnout o převodu starých výkazů. Staré relace ani PINy se nepřenášejí.

Na vaše stávající stránky stačí přidat odkaz „Výkazy zaměstnanců“. Vlastní subdoménu lze řešit později se správcem DNS. Žádná nová adresa zatím nebyla zřízena.

## Místní ověření bez účtů
`npm ci` → `npm run init:local` → `npm run db:migrate` → `npm run dev`.
Otevřít http://localhost:3000. SETUP_TOKEN najdete jen ve svém .env. Místní server naslouchá pouze na tomto počítači a není určen k internetovému provozu. Produkční API používá zabezpečené cookies.

## Aktualizace a zálohy
`npm run prepare:hosting` provede kontrolu typů, testy a build. Změny nasazuje Netlify z repozitáře. Případné nové migrace spouští správce ručně přes `npm run db:migrate` před nasazením změn, které je potřebují. Databáze je oddělená od nasazení; novým buildem se nemaže.
Správce může v aplikaci stáhnout JSON datovou zálohu. Ta neobsahuje přihlašovací tajemství a není kompletní obnovou serveru. Kompletní zálohu pořizujte pomocí nástrojů Turso/libSQL a samostatně chráněného AUTH_SECRET. Zálohy a .env se nikdy neukládají do veřejného repozitáře. Před ostrým provozem ověřte obnovu na testovací databázi.

## Technické provedení
React/Vite frontend, Netlify Function na /api/data, server/app.mjs se serverovým ověřováním oprávnění, Turso libSQL přes parametrizované SQL. Skupiny zápisů jsou atomické; migrační skript používá transakce a kontrolu hashe již použitých migrací. API bere IP pro omezení pokusů pouze z Netlify context.ip. Tajné hodnoty nejsou součástí browserového kódu. Fungování v konkrétním Netlify účtu a skutečná vzdálená Turso databáze ještě vyžadují ověření po připojení účtů.

## Přihlášení zaměstnance

1. Správce přidá zaměstnance. Aplikace zobrazí PIN a jednorázový aktivační odkaz.
2. Správce je předá konkrétnímu zaměstnanci důvěrným způsobem.
3. Zaměstnanec otevře odkaz na svém telefonu nebo počítači a potvrdí připojení zařízení.
4. Následně vybírá pracoviště a zadává pouze PIN. Přihlášení trvá 8 hodin.
5. Pro jiný prohlížeč / zařízení je třeba nový aktivační odkaz. Propojení zařízení platí 90 dní, odkaz 24 hodin a lze ho použít pouze jednou.

Na sdíleném zařízení se přístup při aktivaci jiného profilu přepne na nového zaměstnance. Pro osobní přístup doporučujeme vlastní prohlížečový profil. Po práci se odhlaste. PIN samotný na nepropojeném zařízení nefunguje.

Účetní se vytváří v části Zaměstnanci volbou role Účetní. Zobrazené přihlašovací jméno a náhodné heslo se předají účetní; své heslo si následně může změnit v pravidlech výpočtu. Správce může přístup účetní deaktivovat.


## Import PREMIER podle vzoru z 22. 10. 2026
V sekci Pro účetní vyberte měsíc a konkrétní firmu, otevřete Nastavení kódů a středisek v části PREMIER. Kódy dodá účetní z číselníku dané firmy; příklady ve vzoru neurčují jejich význam. U každého použitého typu nastavte Dny/směny: 1 za zápis, hodiny / plán dne, nebo 0 (jen hodiny). Nastavení potvrďte a uložte. Prázdné kódy u nepoužitých typů nevadí; použitý typ bez kódu blokuje celý export. Osobní čísla nastavuje správce v profilu zaměstnance. Interní ID se v PREMIER exportu nepoužívá.
TXT obsahuje přesně 15 polí, bez záhlaví a bez BOM, CRLF konce řádků. Název začíná RRRRMM. Pořadí: Rok;Mesic;Stredisko;Pracovnik;Kód;KorunyCelkem;Dny;Hodiny;Zakázka;Analýza1;Analýza2;Analýza3;dat_od;dat_do;sazba. Desetinná čárka; směny na 1 a hodiny na 2 desetinná místa. Datumy DD.MM.RRRR vždy vyplněné a v období výkazu. Částky, sazby a analýzy jsou prázdné. Číselná střediska jsou volitelná. Soubory obsahují jen ASCII (číselná pole, ASCII kódy), takže nezávisí na českém kódování znaků.
Navazující kalendářní dny stejného typu, kódu a pracoviště se sčítají. Nevyplněný den, jiná firma, absence či jiné pracoviště interval rozdělí. Přesnoční směna patří dni začátku. Absence používá zapsané hodiny absence; pro podíl směny musí být kladný plán. Export odmítne chybějící nebo duplicitní osobní číslo v exportované skupině, chybné kódy a střediska. Starší záznamy bez přiřazené firmy nejprve doplňte.
Firma není sloupcem importu: každá firma má svůj TXT, všichni její odevzdaní zaměstnanci jsou v jednom souboru. První import musí účetní ověřit v PREMIERu; export sám data do účetního programu neposílá. Opakovaný import stejného souboru může vést k duplicitám podle nastavení PREMIERu. Původní CSV/ZIP zůstává k dispozici pro kontrolu.
