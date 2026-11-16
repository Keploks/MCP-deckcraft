import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";
import { run } from "../lib/exec.js";
import { texto, json, error } from "../lib/respuestas.js";

const CLI_CANDIDATES = [
  "C:\\Program Files\\ArtCraft\\DeckCraft\\deckcraft-cli.exe",
  "C:\\Program Files (x86)\\ArtCraft\\DeckCraft\\deckcraft-cli.exe",
];

function encontrarCli(): string | null {
  for (const p of CLI_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function cliNoDisponible(): Promise<ReturnType<typeof error> | null> {
  const cli = encontrarCli();
  if (cli) return null;
  return error(
    "No se encontró deckcraft-cli.exe. Verifica que DeckCraft esté instalado en C:\\Program Files\\ArtCraft\\DeckCraft\\. " +
      "Si está en otra ubicación, reinstálalo o ajusta la instalación para que el CLI esté disponible.",
  );
}

function asegurarArchivoEntrada(filePath: string, debeExistir = true): string | null {
  const abs = path.resolve(filePath);
  if (!debeExistir) return null;
  if (!fs.existsSync(abs)) {
    return `El archivo de entrada no existe: ${abs}. Verifica la ruta.`;
  }
  const st = fs.statSync(abs);
  if (!st.isFile()) {
    return `La ruta indicada no es un archivo: ${abs}`;
  }
  return null;
}

function asegurarExtensionSalida(outPath: string, permitidas: string[]): string | null {
  const ext = path.extname(outPath).toLowerCase();
  if (!permitidas.includes(ext)) {
    return `La extensión de salida "${ext || "(sin extensión)"}" no es válida. Usa una de: ${permitidas.join(", ")}.`;
  }
  return null;
}

function archivoExiste(p: string): boolean {
  try {
    return fs.existsSync(path.resolve(p));
  } catch {
    return false;
  }
}

async function ejecutarCli(
  args: string[],
  options: { timeoutMs?: number } = {},
) {
  const cli = encontrarCli();
  if (!cli) {
    return { stdout: "", stderr: "CLI no encontrado", code: 127 };
  }
  return run(cli, args, { timeoutMs: options.timeoutMs ?? 120_000 });
}

function formatearFallo(comando: string, res: { stdout: string; stderr: string; code: number }) {
  const detalle = (res.stderr || res.stdout || "").trim();
  return error(
    `Falló ${comando} (código ${res.code}). ${detalle || "Sin detalle."} ` +
      "Revisa que DeckCraft esté instalado, que las rutas sean correctas y que el archivo no esté dañado.",
  );
}

export function register(server: McpServer) {
  server.registerTool(
    "deckcraft_estado",
    {
      description:
        "Comprueba si DeckCraft y su CLI (deckcraft-cli.exe) están instalados y accesibles en este equipo. " +
        "Úsala primero para diagnosticar problemas o confirmar la instalación antes de otras operaciones.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const guiPath = "C:\\Program Files\\ArtCraft\\DeckCraft\\deckcraft.exe";
      const cliPath = encontrarCli();
      let version = "";
      if (cliPath) {
        const v = await ejecutarCli(["--version"], { timeoutMs: 15_000 });
        if (v.code === 0) version = v.stdout.trim();
      }
      return json({
        guiInstalada: fs.existsSync(guiPath),
        guiPath,
        cliInstalado: Boolean(cliPath),
        cliPath: cliPath ?? null,
        cliVersion: version || null,
        notas:
          "La mayoría de herramientas usan el CLI y no requieren que la app esté abierta. " +
          "Para controlar una instancia abierta se necesita iniciar DeckCraft con --control PORT.",
      });
    },
  );

  server.registerTool(
    "deckcraft_info_presentacion",
    {
      description:
        "Lee los metadatos de una presentación (.deckcraft o .pptx) sin abrir la GUI: diapositivas, layouts, fuentes, secciones, tamaño y medios. " +
        "Úsala para inspeccionar o resumir un archivo antes de renderizarlo, convertirlo o editarlo.",
      inputSchema: {
        archivo: z
          .string()
          .describe("Ruta absoluta o relativa al archivo de presentación (.deckcraft o .pptx)."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ archivo }) => {
      const noCli = await cliNoDisponible();
      if (noCli) return noCli;
      const errIn = asegurarArchivoEntrada(archivo, true);
      if (errIn) return error(errIn);
      const abs = path.resolve(archivo);
      const res = await ejecutarCli(["info", abs], { timeoutMs: 120_000 });
      if (res.code !== 0) return formatearFallo("deckcraft-cli info", res);
      try {
        return json(JSON.parse(res.stdout));
      } catch {
        return texto(res.stdout.trim());
      }
    },
  );

  server.registerTool(
    "deckcraft_listar_comandos",
    {
      description:
        "Lista los comandos disponibles del motor de DeckCraft que se pueden usar en ejecuciones por lotes (run/app), con sus parámetros. " +
        "Úsala para descubrir qué acciones admite la app (insertar formas, editar texto, etc.) antes de usar deckcraft_ejecutar_comandos.",
      inputSchema: {
        filtro: z
          .string()
          .optional()
          .describe("Texto opcional para filtrar por id o nombre de comando (sin distinguir mayúsculas)."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ filtro }) => {
      const noCli = await cliNoDisponible();
      if (noCli) return noCli;
      const args = ["commands", ...(filtro ? [filtro] : [])];
      const res = await ejecutarCli(args, { timeoutMs: 30_000 });
      if (res.code !== 0) return formatearFallo("deckcraft-cli commands", res);
      return texto(res.stdout.trim() || "No se encontraron comandos.");
    },
  );

  server.registerTool(
    "deckcraft_describir_comando",
    {
      description:
        "Muestra la ayuda detallada de un comando específico del motor de DeckCraft: descripción, parámetros y cómo usarlo. " +
        "Úsala para conocer la sintaxis exacta antes de ejecutar un comando con deckcraft_ejecutar_comandos.",
      inputSchema: {
        comando: z
          .string()
          .describe("ID del comando a describir (por ejemplo: slide.new, shape.insert, file.info)."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ comando }) => {
      const noCli = await cliNoDisponible();
      if (noCli) return noCli;
      const res = await ejecutarCli(["describe", comando], { timeoutMs: 30_000 });
      if (res.code !== 0) {
        return error(
          `No se pudo describir el comando "${comando}". ${(res.stderr || res.stdout).trim()} ` +
            "Usa deckcraft_listar_comandos para ver los IDs válidos.",
        );
      }
      return texto(res.stdout.trim());
    },
  );

  server.registerTool(
    "deckcraft_renderizar_diapositiva",
    {
      description:
        "Renderiza una diapositiva de una presentación a una imagen PNG usando el motor de DeckCraft (sin abrir la GUI). " +
        "Úsala para obtener una vista previa o exportar una diapositiva concreta como imagen.",
      inputSchema: {
        archivo: z
          .string()
          .describe("Ruta al archivo de presentación (.deckcraft o .pptx)."),
        salida_png: z
          .string()
          .describe("Ruta del archivo PNG de salida a crear."),
        indice_diapositiva: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Índice de la diapositiva (base 0). Por defecto 0."),
        escala: z
          .number()
          .positive()
          .optional()
          .describe("Píxeles por punto (por defecto 2; 960x540 pt -> 1920x1080 px)."),
        modo_edicion: z
          .boolean()
          .optional()
          .describe("Si es true, dibuja como en el editor (prompts y contornos de marcadores)."),
        fondo_transparente: z
          .boolean()
          .optional()
          .describe("Si es true, omite el fondo de la diapositiva."),
        confirmar_sobrescritura: z
          .literal(true)
          .optional()
          .describe("Obligatorio con valor true si el archivo de salida ya existe, para permitir sobrescribirlo."),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ archivo, salida_png, indice_diapositiva, escala, modo_edicion, fondo_transparente, confirmar_sobrescritura }) => {
      const noCli = await cliNoDisponible();
      if (noCli) return noCli;
      const errIn = asegurarArchivoEntrada(archivo, true);
      if (errIn) return error(errIn);
      const errExt = asegurarExtensionSalida(salida_png, [".png"]);
      if (errExt) return error(errExt);
      const outAbs = path.resolve(salida_png);
      if (archivoExiste(outAbs) && confirmar_sobrescritura !== true) {
        return error(
          `El archivo de salida ya existe: ${outAbs}. Para sobrescribirlo vuelve a llamar con confirmar_sobrescritura=true.`,
        );
      }
      fs.mkdirSync(path.dirname(outAbs), { recursive: true });
      const args = ["render", path.resolve(archivo), "--slide", String(indice_diapositiva ?? 0)];
      if (escala !== undefined) args.push("--scale", String(escala));
      if (modo_edicion) args.push("--edit");
      if (fondo_transparente) args.push("--transparent");
      args.push(outAbs);
      const res = await ejecutarCli(args, { timeoutMs: 180_000 });
      if (res.code !== 0) return formatearFallo("deckcraft-cli render", res);
      return texto(`Render completado. ${res.stdout.trim() || `Imagen: ${outAbs}`}`);
    },
  );

  server.registerTool(
    "deckcraft_convertir_presentacion",
    {
      description:
        "Convierte una presentación entre formatos soportados por DeckCraft (.deckcraft, .pptx, .pdf, .txt, .md, .png, .jpg, .gif) sin abrir la GUI. " +
        "Úsala para exportar a PDF/PPTX/imagen o extraer el esquema en texto/markdown.",
      inputSchema: {
        archivo_entrada: z
          .string()
          .describe("Ruta al archivo de entrada (.deckcraft o .pptx)."),
        archivo_salida: z
          .string()
          .describe(
            "Ruta del archivo de salida. El formato se determina por la extensión: .deckcraft, .pptx, .pdf, .txt, .md, .png, .jpg o .gif.",
          ),
        confirmar_sobrescritura: z
          .literal(true)
          .optional()
          .describe("Obligatorio con valor true si el archivo de salida ya existe, para permitir sobrescribirlo."),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ archivo_entrada, archivo_salida, confirmar_sobrescritura }) => {
      const noCli = await cliNoDisponible();
      if (noCli) return noCli;
      const errIn = asegurarArchivoEntrada(archivo_entrada, true);
      if (errIn) return error(errIn);
      const errExt = asegurarExtensionSalida(archivo_salida, [
        ".deckcraft",
        ".pptx",
        ".pdf",
        ".txt",
        ".md",
        ".png",
        ".jpg",
        ".gif",
      ]);
      if (errExt) return error(errExt);
      const outAbs = path.resolve(archivo_salida);
      if (archivoExiste(outAbs) && confirmar_sobrescritura !== true) {
        return error(
          `El archivo de salida ya existe: ${outAbs}. Para sobrescribirlo vuelve a llamar con confirmar_sobrescritura=true.`,
        );
      }
      fs.mkdirSync(path.dirname(outAbs), { recursive: true });
      const res = await ejecutarCli(["convert", path.resolve(archivo_entrada), outAbs], { timeoutMs: 240_000 });
      if (res.code !== 0) return formatearFallo("deckcraft-cli convert", res);
      return texto(`Conversión completada. ${res.stdout.trim() || `Salida: ${outAbs}`}`);
    },
  );

  server.registerTool(
    "deckcraft_ejecutar_comandos",
    {
      description:
        "Ejecuta comandos del motor de DeckCraft sobre una presentación (o una nueva/en blanco) y opcionalmente guarda o exporta el resultado. " +
        "Úsala para crear o modificar presentaciones de forma automatizada. Requiere confirmar=true porque puede escribir archivos. " +
        "Consulta los comandos y sus parámetros con deckcraft_listar_comandos y deckcraft_describir_comando.",
      inputSchema: {
        comandos: z
          .array(z.string().min(1))
          .min(1)
          .describe(
            "Lista de comandos en formato 'id={...json...}' o solo 'id' si no requiere parámetros, en orden de ejecución (ej: 'slide.new={\"title\":\"Hola\"}').",
          ),
        archivo_entrada: z
          .string()
          .optional()
          .describe("Ruta de la presentación de entrada (.deckcraft o .pptx). Si se omite y no se usa usar_muestra, se parte de una presentación nueva."),
        usar_muestra: z
          .boolean()
          .optional()
          .describe("Si es true, usa la presentación de muestra de DeckCraft como base."),
        guardar_en: z
          .string()
          .optional()
          .describe("Ruta donde guardar la presentación resultante (.deckcraft, .pptx, .pdf o .md)."),
        exportar_en: z
          .string()
          .optional()
          .describe("Ruta donde exportar (png, jpg, pdf, pptx o gif) la diapositiva/presentación actual."),
        parametros_exportacion: z
          .record(z.string(), z.any())
          .optional()
          .describe("Opciones JSON para la exportación (p.ej. {\"width\":\"large\",\"secondsPerSlide\":3} para GIF)."),
        mostrar_resultados: z
          .boolean()
          .optional()
          .describe("Si es true, incluye la respuesta de cada comando (útil para obtener IDs creados)."),
        confirmar: z
          .literal(true)
          .describe("Debe ser true para ejecutar. Esta operación puede crear o sobrescribir archivos de salida."),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ comandos, archivo_entrada, usar_muestra, guardar_en, exportar_en, parametros_exportacion, mostrar_resultados, confirmar }) => {
      if (confirmar !== true) {
        return error("Debes pasar confirmar=true para ejecutar comandos que pueden escribir archivos.");
      }
      const noCli = await cliNoDisponible();
      if (noCli) return noCli;
      if (archivo_entrada) {
        const errIn = asegurarArchivoEntrada(archivo_entrada, true);
        if (errIn) return error(errIn);
      }
      if (guardar_en) {
        const errExt = asegurarExtensionSalida(guardar_en, [".deckcraft", ".pptx", ".pdf", ".md"]);
        if (errExt) return error(errExt);
        fs.mkdirSync(path.dirname(path.resolve(guardar_en)), { recursive: true });
      }
      if (exportar_en) {
        const errExt = asegurarExtensionSalida(exportar_en, [".png", ".jpg", ".jpeg", ".pdf", ".pptx", ".gif"]);
        if (errExt) return error(errExt);
        fs.mkdirSync(path.dirname(path.resolve(exportar_en)), { recursive: true });
      }

      const args: string[] = ["run"];
      if (archivo_entrada) args.push("--in", path.resolve(archivo_entrada));
      if (usar_muestra) args.push("--sample");
      for (const c of comandos) {
        args.push("--cmd", c);
      }
      if (guardar_en) args.push("--save", path.resolve(guardar_en));
      if (exportar_en) {
        args.push("--export", path.resolve(exportar_en));
        if (parametros_exportacion) {
          args.push("--export-params", JSON.stringify(parametros_exportacion));
        }
      }
      if (mostrar_resultados) args.push("--print");

      const res = await ejecutarCli(args, { timeoutMs: 300_000 });
      if (res.code !== 0) return formatearFallo("deckcraft-cli run", res);
      const salida = (res.stdout || "").trim();
      return texto(salida || "Comandos ejecutados correctamente.");
    },
  );

  server.registerTool(
    "deckcraft_comando_app",
    {
      description:
        "Envía un comando o método a una instancia de DeckCraft ya abierta que fue iniciada con --control PORT. " +
        "Úsala para controlar la app en vivo (p.ej. capturas, acciones en la ventana actual). Requiere confirmar=true. " +
        "Si la app no responde, indícale al usuario que la inicie como: deckcraft.exe --control 7979",
      inputSchema: {
        puerto: z
          .number()
          .int()
          .min(1)
          .max(65535)
          .optional()
          .describe("Puerto del servidor de control (por defecto 7979, el que usa --control)."),
        comando: z
          .string()
          .optional()
          .describe("ID de comando a ejecutar en la app (ej: shape.insert). Alternativa a metodo."),
        parametros: z
          .record(z.string(), z.any())
          .optional()
          .describe("Parámetros del comando o método como objeto JSON."),
        metodo: z
          .string()
          .optional()
          .describe("Método del canal de control (ej: ui.screenshot). Alternativa a comando."),
        confirmar: z
          .literal(true)
          .describe("Debe ser true para ejecutar, ya que puede modificar el estado de la app o archivos."),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ puerto, comando, parametros, metodo, confirmar }) => {
      if (confirmar !== true) {
        return error("Debes pasar confirmar=true para enviar comandos a la app.");
      }
      const noCli = await cliNoDisponible();
      if (noCli) return noCli;
      if (!comando && !metodo) {
        return error("Debes indicar 'comando' o 'metodo' para enviar a la app.");
      }
      if (comando && metodo) {
        return error("Indica solo uno: 'comando' o 'metodo', no ambos.");
      }
      const args: string[] = ["app"];
      if (puerto !== undefined) args.push("--port", String(puerto));
      if (metodo) {
        args.push("--method", metodo);
        if (parametros) args.push(JSON.stringify(parametros));
      } else if (comando) {
        args.push(comando);
        if (parametros) args.push(JSON.stringify(parametros));
      }
      const res = await ejecutarCli(args, { timeoutMs: 60_000 });
      if (res.code !== 0) {
        const detalle = (res.stderr || res.stdout || "").trim();
        return error(
          `No se pudo comunicar con la app DeckCraft (código ${res.code}). ${detalle} ` +
            "Asegúrate de que DeckCraft esté abierto con control habilitado, por ejemplo: deckcraft.exe --control 7979 " +
            "y que el puerto coincida.",
        );
      }
      try {
        return json(JSON.parse(res.stdout));
      } catch {
        return texto(res.stdout.trim() || "Comando enviado correctamente.");
      }
    },
  );
}
