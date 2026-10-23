# Risorse del Sigillatore

Ogni file SVG qui dentro diventa disponibile nell'editor.

- `figure/` → figure da mettere sullo scudo o nel capo di gilda
- `ornamenti/` → elementi sopra lo scudo (corone, elmi, cimieri…)

## Aggiungere una figura

1. Salva l'SVG in `figure/` (o `ornamenti/`) con un nome in minuscolo, per esempio `chiave.svg`.
2. Fai commit e push: la GitHub Action rigenera `manifest.json` da sola.
   In locale lancia `node scripts/build-manifest.mjs`.

Per provare un file senza toccare la cartella usa **Prova SVG** nell'editor: la figura resta solo nel tuo browser.

## Come disegnarla

Il file viene rasterizzato e ricalcato, quindi va bene qualunque SVG (Inkscape, Illustrator, Affinity, tracciati, tratti, gruppi, trasformazioni). Contano solo i colori:

| Colore nel file | Significato |
|---|---|
| nero o qualunque colore scuro | corpo della figura, prende il primo smalto |
| rosso puro (`#ff0000`) | parti nel secondo smalto (es. la fodera della corona) |
| bianco o trasparente | vuoto: buchi e linee interne, che nella cera diventano solchi o rilievi |

Consigli:

- **ViewBox stretto** attorno alla figura: la figura viene centrata sul suo viewBox.
- **Dettagli interni ad almeno ~2% del lato**: sotto quella soglia, su un sigillo da 5 cm, spariscono nella stampa.
- Una figura orientata a destra araldica (verso sinistra di chi guarda) è la norma; il pulsante *Rivolta* la specchia.

## Metadati facoltativi per la blasonatura

Attributi sul tag `<svg>` radice:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"
     data-nome="Chiave"
     data-singolare="una chiave"
     data-articolo="alla chiave"
     data-plurale="chiavi">
```

Per gli ornamenti puoi aggiungere `data-blasone="timbrato dalla corona reale"`.
Un file caricato con *Prova SVG* è trattato come ornamento se ha `data-tipo="ornamento"`.

## Gilde predefinite (`gilde.json`)

Ogni gilda del menù "Gilda" del capo è una voce di `gilde.json`:

```json
{ "id": "fabbri", "nome": "Gilda dei Fabbri, Corazzai e Spadai", "classe": "maggiore",
  "smalto": "argento", "figura": "martello", "smaltoFigura": "nero" }
```

- `classe`: `maggiore` (linea dritta) o `minore` (linea merlata). Le classi e la loro linea stanno in `classi`.
- Per forzare un'altra linea aggiungi `"linea"`: `dritta`, `ondata`, `dentata` o `merlata`.
- `figura`: nome di un file di `figure/`, senza `.svg`.
- Smalti: `oro`, `argento`, `rosso`, `azzurro`, `verde`, `porpora`, `nero`, `armellino`.
- `smaltoFigura2` è facoltativo: è il colore delle parti rosse dell'SVG.
- Non cambiare l'`id` di una gilda già usata: gli stemmi salvati vi fanno riferimento.
- Se modifichi smalti o figura di una gilda, si aggiornano tutti gli stemmi di quella gilda.
