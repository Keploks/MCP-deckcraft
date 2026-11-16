# Investigación - DeckCraft MCP

## Resumen
- **Aplicación:** DeckCraft (ArtCraft) en Windows.
- **Ejecutable GUI:** `C:\Program Files\ArtCraft\DeckCraft\deckcraft.exe`
- **CLI oficial:** `C:\Program Files\ArtCraft\DeckCraft\deckcraft-cli.exe` (v0.18.1), descubierto en la misma carpeta.
- **Detección:** aparece en `Get-StartApps` como `DeckCraft` con AppID `{6D809377-6AF0-444B-8957-A3773F02200E}\ArtCraft\DeckCraft\deckcraft.exe`. Datos locales en `%LOCALAPPDATA%\ArtCraft` y `%LOCALAPPDATA%\ArtCraft Launcher`.

## Vías evaluadas (de más robusta a más frágil)

1. **API HTTP / WebSocket / plugin oficial:** no se encontró endpoint HTTP expuesto por defecto. Sin embargo, `deckcraft.exe` acepta `--control PORT` para iniciar un servidor de control JSON en `127.0.0.1:PORT`, y `deckcraft-cli.exe app [--port PORT] ...` permite enviar comandos a esa instancia. También `deckcraft-cli.exe mcp` sirve comandos vía MCP sobre stdio (puente propio de la app). **Vía robusta/oficial disponible mediante CLI/puente de la app.**
2. **CLI de la app:** `deckcraft-cli.exe` ofrece control headless completo de presentaciones (`.deckcraft`, `.pptx`) sin ventana: `info`, `render`, `render-transition`, `convert`, `run` (comandos con `--cmd`/`--cmd-file`, `--save`, `--export`), `commands`, `describe`, `app`, `mcp`, `bench`, `links`. Es la interfaz más directa y estable para automatización desde Node.
3. **Archivos de datos:** las presentaciones del usuario son archivos `.pptx`/`.deckcraft` en disco que el CLI puede leer/escribir; no se identificó un almacén interno adicional que deba manipularse directamente.
4. **Scripting del SO (COM/PowerShell/registro/esquemas URL):** no se halló evidencia de ProgID COM ni esquema URL específico durante la investigación de lectura; innecesario dado el CLI.
5. **Automatización de UI:** no necesaria.

## Vía elegida
**CLI (`deckcraft-cli.exe`) invocado con `execFile`/`run()`** desde el MCP, pasando argumentos como lista (sin shell ni concatenación). 
- Operaciones de lectura y render/export/conversión se hacen con subcomandos dedicados (`info`, `commands`, `describe`, `render`, `convert`).
- Ediciones y operaciones compuestas se hacen con `run --in/--sample --cmd/--cmd-file --save/--export --print`.
- Control de la app abierta (si el usuario la inició con `--control PORT`) mediante `app --port PORT ...`.

Esta vía es oficial, documentada por `--help`, no requiere que la GUI esté abierta para la mayoría de tareas y evita automatización frágil de UI.

## Alternativas descartadas
- **Usar `deckcraft-cli mcp` como único backend:** ya es un MCP propio, pero el objetivo del proyecto es construir/entregar este servidor MCP (`deckcraft-v3`) con herramientas propias y seguras; además se busca exponer una interfaz curada (4-8 herramientas) y validada.
- **Parsear/modificar `.pptx` o `.deckcraft` directamente:** frágil y propenso a corrupción; el CLI ya implementa lectura/escritura/conversión.
- **Automatización de UI / COM:** innecesaria y menos robusta.

## Pruebas de lectura realizadas (sin modificar datos del usuario)
- `deckcraft-cli.exe --help`, `-h`, `help`, `--version` (0.18.1).
- `deckcraft-cli.exe help info|render|run|app|convert|mcp|commands`, `commands`, `describe slide.new`, `describe file.info`, `links`.
- `deckcraft-cli.exe info "...\Bootcamp 02.pptx"`: devolvió JSON válido con metadatos, fuentes, layouts, medios y diapositivas (lectura correcta).

## Limitaciones y notas
- **Rutas con caracteres especiales:** los archivos existen en OneDrive/Downloads con acentos y codificación cp1252 en la salida de consola; el CLI funciona si recibe la ruta correcta. El MCP debe aceptar rutas tal cual y reportar errores claros si el archivo no existe.
- **Herramientas que escriben archivos:** `render`, `convert`, `run --save/--export` crean o sobrescriben archivos de salida; deben validarse y, cuando haya riesgo de sobrescritura/modificación significativa, exigir confirmación explícita.
- **`deckcraft-cli app`:** solo funciona si la GUI se ejecutó con `--control PORT`; si no, fallará (el MCP debe explicar cómo iniciarla: `deckcraft.exe --control 7979`).
- **`deckcraft-cli mcp`:** puente MCP propio disponible, pero no usado como dependencia interna aquí.
- **GUI no requerida** para `info/commands/describe/render/convert/run` sobre archivos.
- No se probaron operaciones que modifiquen o borren datos del usuario (solo lectura). Render/convert/run con escritura no se ejecutaron contra archivos reales del usuario en esta fase.
