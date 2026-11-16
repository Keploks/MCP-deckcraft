# MCP DeckCraft (deckcraft-v3)

Servidor **MCP** (Model Context Protocol) en TypeScript para controlar **DeckCraft** (ArtCraft) en Windows mediante su CLI oficial `deckcraft-cli.exe` (sin automatización de UI).

## Qué hace

- Detecta la instalación de DeckCraft/CLI y su versión.
- Inspecciona presentaciones (`.deckcraft`, `.pptx`): diapositivas, layouts, fuentes, secciones y medios.
- Consulta los comandos del motor de DeckCraft y su documentación (`commands` / `describe`).
- Renderiza una diapositiva a PNG, convierte presentaciones entre formatos y ejecuta comandos del motor para crear/editar/exportar.
- Puede enviar comandos a una instancia de la app abierta si se inició con control remoto (`--control PORT`).

La integración se basa en el CLI instalado en `C:\Program Files\ArtCraft\DeckCraft\deckcraft-cli.exe` (vía robusta y oficial; ver `INVESTIGACION.md`).

## Herramientas

| Herramienta | Qué hace | Modifica datos / efecto |
|---|---|---|
| `deckcraft_estado` | Comprueba instalación de GUI/CLI y versión. | No (solo lectura) |
| `deckcraft_info_presentacion` | Devuelve metadatos y estructura de una presentación (`info`). | No (solo lectura) |
| `deckcraft_listar_comandos` | Lista comandos del motor disponibles, con filtro opcional. | No (solo lectura) |
| `deckcraft_describir_comando` | Muestra ayuda/parametrización de un comando del motor. | No (solo lectura) |
| `deckcraft_renderizar_diapositiva` | Renderiza una diapositiva a PNG (`render`). | Sí: crea archivo de salida; puede sobrescribir si se confirma (`confirmar_sobrescritura=true`) |
| `deckcraft_convertir_presentacion` | Convierte entre formatos soportados (`convert`). | Sí: crea archivo de salida; puede sobrescribir si se confirma |
| `deckcraft_ejecutar_comandos` | Ejecuta comandos del motor y opcionalmente guarda/exporta (`run`). Requiere `confirmar=true`. | Sí: puede crear/modificar/sobrescribir archivos de salida |
| `deckcraft_comando_app` | Envía comando/método a la app abierta con `--control`. Requiere `confirmar=true`. | Sí: puede modificar el estado/documento en la app en vivo |

## Ejemplos de frases para pedirlas a la IA

1. "Usa `deckcraft_estado` para verificar que DeckCraft está instalado y dime la versión del CLI."
2. "Con `deckcraft_info_presentacion` lee `C:\ruta\mi_presentacion.pptx` y dime cuántas diapositivas y qué layouts tiene."
3. "Convierte `C:\ruta\presentacion.pptx` a PDF con `deckcraft_convertir_presentacion` (y confirma la sobrescritura si el archivo ya existe)."

## Requisitos y permisos

- **Sistema:** Windows con DeckCraft instalado.
- **Instalación esperada:** `C:\Program Files\ArtCraft\DeckCraft\deckcraft.exe` y `C:\Program Files\ArtCraft\DeckCraft\deckcraft-cli.exe`.
- **Node.js** y dependencias del proyecto instaladas (`npm install`), proyecto compilado (`npm run build`).
- **Permisos de sistema de archivos:** lectura de las presentaciones de entrada y escritura en las rutas de salida para render/convert/guardar/exportar.
- **Control de app en vivo (opcional):** para `deckcraft_comando_app`, la app debe iniciarse con `deckcraft.exe --control 7979` (o el puerto indicado) y el puerto debe ser accesible en `127.0.0.1`.
- **Sin secretos** ni credenciales externas; no requiere acceso de red.

## Limitaciones conocidas

- Depende de la ruta/instalación estándar del CLI; si DeckCraft está en otra ubicación, las herramientas no lo encontrarán.
- `deckcraft_comando_app` solo funciona si la GUI se ejecutó con `--control PORT`; si no, devuelve un error con instrucciones.
- Rutas con caracteres especiales (acentos/OneDrive) dependen de que el CLI reciba la ruta correcta; se aceptan rutas tal cual y se reportan errores claros si no existen.
- Verificado con una presentación real (copia): lectura de metadatos, render a PNG, conversión a PDF y agregado de una diapositiva guardada en un archivo nuevo (el original no se modifica). Probado con el modelo DeepSeek V4.1 Flash en opencode. Con Nemotron 3.5 Lightning la herramienta no guardaba el resultado aunque el modelo decía que sí, por lo que conviene verificar siempre el archivo generado.
- `deckcraft_comando_app` (control de la app abierta) no se probó en la demo.
- Las herramientas de escritura exigen confirmación (`confirmar=true` o `confirmar_sobrescritura=true`) para reducir riesgos de sobrescritura.
- No se creó `scripts/preparar-app.mjs`: el uso headless vía CLI no requiere arranque especial; el modo `--control` es opcional y bajo demanda.

## Instalación paso a paso

1. Instala DeckCraft (ArtCraft) en Windows y Node.js.
2. Clona el repositorio y entra a la carpeta:

```
git clone https://github.com/Keploks/MCP-deckcraft.git
cd MCP-deckcraft
```

3. Instala las dependencias y compila:

```
npm install
npm run build
```

4. Ejecuta las pruebas:

```
npm test
```

5. Conecta el servidor a tu cliente MCP (por ejemplo opencode) usando el archivo `opencode.json` del repositorio.
6. Pide una tarea a la IA con alguno de los ejemplos de la sección anterior.

## Utilidad académica

Este MCP automatiza el trabajo repetitivo con presentaciones: revisar su estructura, renderizar diapositivas, convertirlas a PDF y agregar contenido sin abrir la aplicación a mano. Está pensado para estudiantes que preparan y entregan presentaciones, especialmente en trabajos grupales. Reduce el tiempo operativo y permite dedicar más esfuerzo al contenido y a la calidad de la comunicación.

## Declaración de uso de IA

El código base se generó con el Constructor del `mcp-starter-kit` y con asistencia de IA, y fue revisado y probado por el autor con archivos reales. Modelos usados en opencode: DeepSeek V4.1 Flash y Nemotron 3.5 Lightning. Con Nemotron la herramienta de edición no guardaba el resultado aunque el modelo afirmaba que sí, por lo que se verificó cada archivo generado.

## Seguridad

- No contiene credenciales, claves ni tokens (`.env` está en `.gitignore`).
- Las herramientas que escriben exigen confirmación explícita.
- Solo opera sobre las rutas que el usuario indica y no usa red.
- Recomendación: probar siempre sobre copias de las presentaciones.
