# Sigillatore

Compositore di stemmi per il mio mondo di gioco e generatore di timbri per ceralacca da stampare in 3D.

Componi lo scudo nell'editor (partizioni, linee ondate o merlate, pezze, capo di gilda con 1–3 figure, figure trascinabili, corona). La pagina scrive la blasonatura e mostra l'impronta nella cera. Poi scarichi l'STL della testa del timbro e del manico.

## Avvio

Il sito è statico, ma deve essere servito da un server perché legge `resources/manifest.json`.

```bash
python3 -m http.server 8000
# poi apri http://localhost:8000
```

## GitHub Pages

1. Crea il repository e fai push di questa cartella sul branch `main`.
2. In **Settings → Pages**, alla voce *Source* scegli **GitHub Actions**.
3. A ogni push la Action `.github/workflows/pages.yml` rigenera l'indice delle figure e pubblica il sito.

## Figure e ornamenti

Stanno in `resources/figure/` e `resources/ornamenti/` come file SVG. Il formato è descritto in [`resources/LEGGIMI.md`](resources/LEGGIMI.md).
Le figure di partenza (incudine, martello, foglia di gelso, bozzolo, orso rampante, covone, tonno, corona reale) sono ricalcate dai miei disegni.

## Dati

L'armoriale si salva nel browser (localStorage). Usa **Esporta** per farne una copia in JSON e **Importa** per riportarlo su un altro computer.

## Stampa (Bambu Lab A1 Mini, PLA)

- **Testa**: stampala con il disegno verso l'alto e l'innesto esagonale sul piatto. Usa l'ugello da 0,2 mm, layer da 0,08–0,1 mm e *ironing* sulle superfici superiori. La tacca sul bordo indica l'alto dello stemma.
- **Manico**: stampalo in piedi, con il pomello sul piatto e l'esagono verso l'alto. Va bene l'ugello da 0,4 mm. Se l'innesto è troppo duro o troppo lasco, cambia *Gioco dell'innesto* e ristampa solo la testa.
- **Uso**: tra un sigillo e l'altro raffredda la testa su un panno umido freddo o su un siberino. Il PLA si ammorbidisce verso i 55–60 °C; il PETG regge meglio.
- Il timbro è già specchiato: nella cera lo stemma si legge dritto.

## Struttura

```
index.html            pagina
css/style.css         stile
js/engine.js          geometria: scudi, partizioni, tratteggio, mesh, STL
js/figures.js         lettura degli SVG di resources/
js/app.js             interfaccia, blasonatura, armoriale
vendor/               Clipper (operazioni sui poligoni) ed earcut (triangolazione)
resources/            figure e ornamenti in SVG + manifest.json
scripts/              build-manifest.mjs
```
