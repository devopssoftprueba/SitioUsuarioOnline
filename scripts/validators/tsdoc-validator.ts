// Importa la función execSync del módulo child_process para ejecutar comandos de terminal
import { execSync } from 'child_process';
// Importa las funciones readFileSync y existsSync del módulo fs para leer archivos y verificar su existencia
import { readFileSync, existsSync } from 'fs';
// Importa todas las funcionalidades del módulo path para manejar rutas de archivos
import * as path from 'path';
// No necesitamos importar reglas externas, ya que nuestro validador será inteligente
// y detectará qué etiquetas son necesarias basándose en el código mismo
const rules = {
    'class': {},
    'function': {},
    'property': {}
};

logDebug('Usando validación inteligente de etiquetas basada en el código');

// Define un tipo ChangedLines que es un objeto con claves string y valores Set<number> para almacenar líneas modificadas por archivo
type ChangedLines = Record<string, Set<number>>;

/**
 * Registra mensajes de depuración con marca de tiempo
 *
 * @param message - El mensaje a mostrar en el log
 */
function logDebug(message: string): void {
    console.log(`[${new Date().toISOString()}] ${message}`);
}

// Imprime un mensaje indicando que el validador TSDoc está en ejecución
logDebug('🔍 Validador TSDoc en ejecución...');

/**
 * Obtiene las líneas modificadas de los archivos en el push actual.
 *
 * @returns Un objeto con los archivos y sus líneas modificadas.
 */
function getChangedLines(): ChangedLines {
    try {
        const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
        const remoteExists = execSync(`git ls-remote --heads origin ${currentBranch}`, { encoding: 'utf8' }).trim();

        let diffCommand;
        if (remoteExists) {
            diffCommand = `git diff origin/${currentBranch}..HEAD -U0 --no-color`;
            logDebug(`Comparando con rama remota: origin/${currentBranch}`);
        } else {
            let baseBranch = 'main';
            try {
                execSync('git rev-parse --verify origin/main', { stdio: 'pipe' });
            } catch (e) {
                try {
                    execSync('git rev-parse --verify origin/master', { stdio: 'pipe' });
                    baseBranch = 'master';
                } catch (e) {
                    try {
                        execSync('git rev-parse --verify origin/develop', { stdio: 'pipe' });
                        baseBranch = 'develop';
                    } catch (e) {
                        diffCommand = 'git diff --staged -U0 --no-color';
                        logDebug('No se encontró rama remota. Usando cambios preparados (staged).');
                    }
                }
            }

            if (!diffCommand) {
                diffCommand = `git diff origin/${baseBranch}..HEAD -U0 --no-color`;
                logDebug(`Rama nueva detectada. Comparando con ${baseBranch}.`);
            }
        }

        logDebug(`Ejecutando comando diff: ${diffCommand}`);
        const diffOutput = execSync(diffCommand, { encoding: 'utf8' });
        logDebug(`Longitud de la salida diff: ${diffOutput.length} bytes`);

        const changedLines: ChangedLines = {};
        const fileRegex = /^diff --git a\/(.+?) b\/(.+)$/;
        const hunkRegex = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

        let currentFile = '';

        const lines = diffOutput.split('\n');
        logDebug(`Procesando ${lines.length} líneas de salida diff`);

        for (const line of lines) {
            const fileMatch = line.match(fileRegex);
            if (fileMatch) {
                const [, , newFile] = fileMatch;
                currentFile = newFile;
                continue;
            }

            const hunkMatch = line.match(hunkRegex);
            if (hunkMatch && currentFile) {
                const startLine = parseInt(hunkMatch[1], 10);
                const lineCount = hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1;
                const linesSet = changedLines[currentFile] || new Set<number>();
                for (let i = 0; i < lineCount; i++) {
                    linesSet.add(startLine + i);
                }
                changedLines[currentFile] = linesSet;
            }
        }

        logDebug(`Se encontraron cambios en ${Object.keys(changedLines).length} archivos`);
        return changedLines;
    } catch (error) {
        logDebug(`Error al obtener líneas cambiadas: ${error}`);
        return {};
    }
}

/**
 * Determina el tipo de declaración basado en la línea de código.
 *
 * @param line - Línea de código a analizar
 * @returns El tipo de declaración identificado
 */
function determineDeclarationType(line: string): keyof typeof rules {
    const trimmed = line.trim();

    if (trimmed.startsWith('class ') || trimmed.startsWith('interface ')) {
        return 'class';
    } else if (
        trimmed.startsWith('function ') ||
        trimmed.match(/^(?:async\s+)?[a-zA-Z0-9_]+\s*\(.*\)\s*{?$/) ||
        trimmed.match(/^(?:public|private|protected)\s+(?:async\s+)?[a-zA-Z0-9_]+\s*\(.*\)\s*{?$/)
    ) {
        return 'function';
    } else if (
        trimmed.match(/^(?:public|private|protected)?\s*[a-zA-Z0-9_]+\s*[:=]/) ||
        trimmed.match(/^(?:readonly|static)\s+[a-zA-Z0-9_]+/)
    ) {
        return 'property';
    }

    return 'function'; // Valor por defecto
}

/**
 * Busca la declaración de clase/metodo/propiedad más cercana hacia arriba.
 *
 * @param lines - Líneas del archivo.
 * @param startIndex - Índice desde donde buscar hacia arriba.
 * @returns El índice de la declaración encontrada y su tipo, o null si no se encuentra.
 */
function findDeclarationLine(
    lines: string[],
    startIndex: number
): { index: number; type: keyof typeof rules } | null {
    for (let i = startIndex; i >= 0; i--) {
        const trimmed = lines[i].trim();

        // --- Nuevas líneas a ignorar ---
        // 1) Apertura de bloque /**…
        if (trimmed.startsWith('/**')) {
            continue;
        }
        // 2) Línea interior de comentario (* …)
        if (trimmed.startsWith('*')) {
            continue;
        }
        // 3) Cierre de bloque */
        if (trimmed === '*/') {
            continue;
        }
        // 4) Líneas en blanco
        if (trimmed === '') {
            continue;
        }

        // --- Declaraciones válidas ---
        if (
            trimmed.startsWith('class ') ||
            trimmed.startsWith('interface ') ||
            trimmed.startsWith('function ') ||
            /^[a-zA-Z0-9_]+\s*\(.*\)\s*{?$/.test(trimmed) || // metodo sin modificador
            trimmed.startsWith('public ') ||
            trimmed.startsWith('private ') ||
            trimmed.startsWith('protected ') ||
            /^[a-zA-Z0-9_]+\s*[:=]/.test(trimmed) // propiedad
        ) {
            return {
                index: i,
                type: determineDeclarationType(trimmed)
            };
        }

        // 5) Cualquier otra línea de código no declarativa: paro de buscar
        break;
    }

    return null;
}

/**
 * Verifica si la documentación está en inglés.
 *
 * @param commentBlock - El bloque de comentarios TSDoc a verificar
 * @returns Array de errores si no está en inglés, array vacío si es válido
 */
function validateEnglishDocumentation(commentBlock: string): string[] {
    const spanishWords = [
        'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
        'para', 'por', 'con', 'sin', 'porque', 'como', 'según', 'cuando',
        'si', 'pero', 'aunque', 'mientras', 'hasta', 'desde', 'entre',
        'función', 'archivo', 'línea', 'código', 'método', 'clase',
        'objeto', 'variable', 'valor', 'parámetro', 'devuelve', 'retorna'
    ];

    const cleanedComment = commentBlock
        .split('\n')
        .map(line => line.trim().replace(/^\*\s*/, ''))
        .join(' ')
        .toLowerCase();

    const foundSpanishWords = spanishWords.filter(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'i');
        return regex.test(cleanedComment);
    });

    if (foundSpanishWords.length > 0) {
        return [`Error: La documentación parece estar en español. Palabras detectadas: ${foundSpanishWords.join(', ')}. La documentación debe estar en inglés.`];
    }

    return [];
}

/**
 * Verifica si existe un bloque de comentarios TSDoc válido para una declaración.
 *
 * @param lines - Líneas del archivo
 * @param declarationIndex - Índice donde está la declaración
 * @param type - Tipo de declaración
 * @returns Lista de errores encontrados
 */
function validateDocumentation(lines: string[], declarationIndex: number, type: keyof typeof rules): string[] {
    // Busca hacia atrás saltando espacios en blanco para encontrar un bloque de comentarios
    let i = declarationIndex - 1;
    let foundComment = false;

    // Búsqueda más tolerante: permite hasta 5 líneas en blanco entre la declaración y el comentario
    const MAX_BLANK_LINES = 5;
    let blankLineCount = 0;

    while (i >= 0) {
        const trimmedLine = lines[i].trim();

        if (trimmedLine === '') {
            blankLineCount++;
            if (blankLineCount > MAX_BLANK_LINES) {
                // Si hay demasiadas líneas en blanco, consideramos que no hay documentación relacionada
                break;
            }
        } else if (trimmedLine === '*/') {
            foundComment = true;
            break;
        } else {
            // Si encontramos una línea no vacía que no es el fin de un comentario, no hay documentación
            break;
        }
        i--;
    }

    if (!foundComment) {
        return [`Error: Falta el bloque TSDoc sobre la declaración de ${type}.`];
    }

    let startCommentIndex = i;
    while (startCommentIndex >= 0 && !lines[startCommentIndex].trim().startsWith('/**')) {
        startCommentIndex--;
    }

    if (startCommentIndex < 0) {
        return [`Error: Se encontró un cierre de comentario sin apertura para la declaración de ${type}.`];
    }

    const commentBlock = lines.slice(startCommentIndex, i + 1).join('\n');

    const errors: string[] = [];

    // Analizar la declaración para determinar qué etiquetas deberían estar presentes
    const originalDeclaration = lines[declarationIndex];

    // Comprobar si la función o metodo tiene parámetros
    if (type === 'function' || type === 'class') {
        const hasParameters = originalDeclaration.includes('(') &&
            !originalDeclaration.includes('()') &&
            !originalDeclaration.includes('( )');

        // Si tiene parámetros pero no hay etiquetas @param
        if (hasParameters && !commentBlock.includes('@param')) {
            errors.push(`Error: La declaración tiene parámetros pero falta documentación con etiquetas @param.`);
        }

        // Si es una función y parece devolver algo (no es void)
        if (type === 'function' &&
            originalDeclaration.includes('): ') &&
            !originalDeclaration.includes('): void') &&
            !commentBlock.includes('@returns') &&
            !commentBlock.includes('@return')) {
            errors.push(`Error: La función parece devolver un valor pero falta la etiqueta @returns.`);
        }
    }

    const languageErrors = validateEnglishDocumentation(commentBlock);
    if (languageErrors.length > 0) {
        errors.push(...languageErrors);
    }

    return errors;
}

/**
 * Válida un archivo verificando la documentación correcta en los cambios.
 *
 * @param filePath - Ruta del archivo.
 * @param changed - Líneas cambiadas.
 * @returns Lista de errores encontrados.
 */
function validateFile(filePath: string, changed: Set<number>): string[] {
    try {
        if (!existsSync(filePath)) {
            logDebug(`Archivo no encontrado: ${filePath}`);
            return [`Error: Archivo no encontrado - ${filePath}`];
        }

        const fileContent = readFileSync(filePath, 'utf8');
        const lines = fileContent.split('\n');
        const errors: string[] = [];

        // Almacena las declaraciones encontradas en líneas cambiadas
        const declarations: Array<{ index: number; type: keyof typeof rules }> = [];

        // Primera pasada: Encuentra todas las declaraciones asociadas con líneas cambiadas
        changed.forEach(lineNumber => {
            const lineIndex = lineNumber - 1;
            if (lineIndex < 0 || lineIndex >= lines.length) return;

            // Registra la línea cambiada para depuración
            logDebug(`Verificando línea cambiada ${lineNumber}: ${lines[lineIndex].trim()}`);

            const declaration = findDeclarationLine(lines, lineIndex);
            if (!declaration) {
                logDebug(`No se encontró declaración para la línea ${lineNumber}`);
                return;
            }

            // Verifica si esta declaración ya está en nuestra lista
            const alreadyIncluded = declarations.some(d => d.index === declaration.index);
            if (!alreadyIncluded) {
                declarations.push(declaration);
                logDebug(`Declaración encontrada en línea ${declaration.index + 1}: ${lines[declaration.index].trim()}`);
            }
        });

        // Segunda pasada: Válida cada declaración única encontrada
        declarations.forEach(({ index: declarationIndex, type }) => {
            logDebug(`Validando ${type} en línea ${declarationIndex + 1} en ${filePath}`);

            const validationErrors = validateDocumentation(lines, declarationIndex, type);
            if (validationErrors.length > 0) {
                const codeLine = lines[declarationIndex].trim();
                errors.push(`Error en línea ${declarationIndex + 1}: ${codeLine}`);
                errors.push(...validationErrors.map(e => `  - ${e}`));
            }
        });

        return errors;
    } catch (error) {
        logDebug(`Error al validar archivo ${filePath}: ${error}`);
        return [`Error al validar archivo ${filePath}: ${error}`];
    }
}

/**
 * Ejecuta la validación en todos los archivos con cambios.
 *
 * @returns True si la validación pasa, false si hay errores.
 */
function runValidation(): boolean {
    try {
        const changedLines = getChangedLines();
        let validationResult = true;
        const errorsByFile: Record<string, string[]> = {};
        let totalErrors = 0;

        for (const file in changedLines) {
            if (
                !file.endsWith('.ts') &&
                !file.endsWith('.tsx') &&
                !file.endsWith('.js') &&
                !file.endsWith('.jsx')
            ) {
                logDebug(`Omitiendo archivo no JavaScript/TypeScript: ${file}`);
                continue;
            }

            if (file.endsWith('tsdoc-validator.ts') || file.includes('node_modules/')) {
                logDebug(`Omitiendo archivo excluido: ${file}`);
                continue;
            }

            const fullPath = path.resolve(file);
            logDebug(`Validando archivo: ${fullPath}`);

            const errors = validateFile(fullPath, changedLines[file]);

            if (errors.length > 0) {
                errorsByFile[file] = errors;
                totalErrors += errors.length;
                validationResult = false;
            }
        }

        if (!validationResult) {
            console.log('\n⚠️  Se encontraron errores de validación TSDoc:');
            console.log('\n╔══════════════════════════════════════════════════════════════════════════════');

            for (const file in errorsByFile) {
                console.log(`║ 📄 Archivo: ${file}`);
                console.log('║ ' + '─'.repeat(80));

                errorsByFile[file].forEach(error => {
                    console.log(`║ ${error}`);
                });

                console.log('╟' + '──'.repeat(40));
            }

            console.log(`╚══════════════════════════════════════════════════════════════════════════════`);
            console.log(`\n📊 Total de errores: ${totalErrors}`);
            console.log('\n⚠️  Por favor, asegúrate de que todas las nuevas declaraciones estén correctamente documentadas en inglés.');
        } else {
            console.log('\n✅ Validación TSDoc completada sin errores. ¡Buen trabajo!');
        }

        return validationResult;
    } catch (error) {
        logDebug(`Error de validación: ${error}`);
        console.error(`\n⚠️  Error en la validación TSDoc: ${error}`);
        return false;
    }
}

// Si este archivo se ejecuta directamente (no importado)
if (require.main === module) {
    console.log('\n🔍 Validador TSDoc en ejecución (análisis inteligente de documentación)');

    const result = runValidation();
    process.exit(result ? 0 : 1);
}

// Exporta la función runValidation y función auxiliar para uso en otros archivos
export { runValidation };