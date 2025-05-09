// Importa la función execSync del módulo child_process para ejecutar comandos de terminal
import { execSync } from 'child_process';
// Importa las funciones readFileSync y existsSync del módulo fs para leer archivos y verificar su existencia
import { readFileSync, existsSync } from 'fs';
// Importa todas las funcionalidades del módulo path para manejar rutas de archivos
import * as path from 'path';

const rules = {
    'class': {
        requiredTags: [], // rules tu class
        optionalTags: ['@description', '@example', '@remarks', '@deprecated', '@category', '@package',
            '@author', '@version', '@since', '@decorator', '@view']
    },
    'function': {
        requiredTags: [], // rules to function
        optionalTags: ['@param', '@returns', '@throws', '@example', '@remarks', '@deprecated',
            '@method', '@event', '@computed']
    },
    'property': {
        requiredTags: [], // rules to property
        optionalTags: ['@description', '@defaultValue', '@remarks', '@deprecated', '@prop',
            '@data', '@input', '@output', '@property']
    }
};

function logDebug(message: string): void {
    console.log(`[${new Date().toISOString()}] ${message}`); //Escribe en la consola el mensaje de error
}

// Imprime un mensaje indicando que el validador TSDoc está en ejecución
logDebug('🔍 Validador TSDoc en ejecución...');

logDebug('Usando validación inteligente de etiquetas basada en el código');

function getChangedLines(): ChangedLines { // Función que obtiene las líneas modificadas comparando la rama actual con su origen o base.

    try {
        const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim(); // Obtiene el nombre de la rama actual activa en Git como una cadena de texto sin espacios.
        const remoteExists = execSync(`git ls-remote --heads origin ${currentBranch}`, { encoding: 'utf8' }).trim(); // Verifica si la rama actual existe en el repositorio remoto.

        let diffCommand; // Declara la variable que almacenará el comando de comparación de diferencias.
        if (remoteExists) { // Si la rama actual existe remotamente...
            diffCommand = `git diff origin/${currentBranch}..HEAD -U3 --no-color`; // Compara los cambios entre HEAD y la misma rama en el remoto.
            logDebug(`Comparando con rama remota: origin/${currentBranch}`); // Registra en log que se está comparando con la rama remota.
        } else {
            let baseBranch = 'main'; // Por defecto, se usará la rama 'main' como base para comparar.
            try {
                execSync('git rev-parse --verify origin/main', { stdio: 'pipe' }); // Verifica si la rama 'main' existe en remoto.
            } catch (e) {
                try {
                    execSync('git rev-parse --verify origin/master', { stdio: 'pipe' }); // Si 'main' no existe, verifica si 'master' está disponible.
                    baseBranch = 'master'; //Si existe, se usará 'master' como base.
                } catch (e) {
                    try {
                        execSync('git rev-parse --verify origin/develop', { stdio: 'pipe' }); // Si 'master' tampoco está, intenta con 'develop'.
                        baseBranch = 'develop'; // Si existe, se usará 'develop' como base.
                    } catch (e) {
                        diffCommand = 'git diff --staged -U3 --no-color'; // Si ninguna rama base está disponible, compara solo los cambios preparados (staged).
                        logDebug('No se encontró rama remota. Usando cambios preparados (staged).'); // Informa que no hay base remota y se usará diff local.
                    }
                }
            }

            if (!diffCommand) {  // Si aún no se definió el comando diff...
                diffCommand = `git diff origin/${baseBranch}..HEAD -U3 --no-color`; // Compara HEAD con la base encontrada ('main', 'master' o 'develop').
                logDebug(`Rama nueva detectada. Comparando con ${baseBranch}.`); // Informa que es una nueva rama comparada contra la rama base.
            }
        }

        logDebug(`Ejecutando comando diff: ${diffCommand}`); // Muestra el comando de comparación que se ejecutará.
        const diffOutput = execSync(diffCommand, { encoding: 'utf8' }); // Ejecuta el comando y guarda la salida como texto.
        logDebug(`Longitud de la salida diff: ${diffOutput.length} bytes`); // Informa la longitud del resultado obtenido en bytes.

        const changedLines: ChangedLines = {}; // Inicializa el objeto donde se guardarán las líneas cambiadas por archivo.
        const fileRegex = /^diff --git a\/(.+?) b\/(.+)$/; // Expresión regular para detectar líneas que indican cambio de archivo.
        const hunkRegex = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/; // Expresión regular para detectar bloques de líneas modificadas (hunks).

        let currentFile = '';  // Variable que mantiene el nombre del archivo actual mientras se procesan los cambios.

        const lines = diffOutput.split('\n'); // Divide la salida del diff en líneas individuales.
        logDebug(`Procesando ${lines.length} líneas de salida diff`); // Informa cuántas líneas se van a procesar.

        for (const line of lines) { // Recorre cada línea de la salida del diff
            const fileMatch = line.match(fileRegex);  // Intenta emparejar la línea con la expresión que detecta archivos modificados.
            if (fileMatch) {
                const [, , newFile] = fileMatch; // Extrae el nombre del archivo nuevo del diff.
                currentFile = newFile; // Actualiza el archivo actual que se está procesando.
                continue; // Pasa a la siguiente línea del diff.
            }

            const hunkMatch = line.match(hunkRegex); // Intenta emparejar la línea con un bloque (hunk) de líneas modificadas.
            if (hunkMatch && currentFile) {
                const startLine = parseInt(hunkMatch[1], 10);  // Convierte el número de línea inicial del cambio en entero.
                const lineCount = hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1;  // Obtiene el número de líneas afectadas; si no hay número, asume una.
                const linesSet = changedLines[currentFile] || new Set<number>(); // Obtiene el set de líneas cambiadas del archivo o crea uno nuevo.
                for (let i = 0; i < lineCount; i++) { // Agrega todas las líneas afectadas al set.
                    linesSet.add(startLine + i);
                }
                changedLines[currentFile] = linesSet; // Guarda el set actualizado en el objeto de líneas cambiadas.
            }
        }

        logDebug(`Se encontraron cambios en ${Object.keys(changedLines).length} archivos`); // Informa cuántos archivos tuvieron líneas modificadas.
        return changedLines; // Devuelve el objeto que contiene los archivos y las líneas modificadas en cada uno.
    } catch (error) {
        logDebug(`Error al obtener líneas cambiadas: ${error}`); // Si ocurre un error, lo registra en el log para depuración.
        return {}; // Devuelve un objeto vacío si falló la operación.
    }
}

// Define un tipo ChangedLines que es un objeto con claves string y valores Set<number> para almacenar líneas modificadas por archivo
type ChangedLines = Record<string, Set<number>>;

/**
 * Determina el tipo de declaración basado en la línea de código.
 *
 * @param line - Línea de código a analizar
 * @returns El tipo de declaración identificado
 */
function determineDeclarationType(line: string): keyof typeof rules {
    const trimmed = line.trim();

    // Clases e interfaces
    if (trimmed.startsWith('class ') || trimmed.startsWith('interface ')) {
        return 'class';
    }

    // Funciones y métodos - todos los casos posibles
    if (
        trimmed.startsWith('function ') ||                                                         // función normal
        trimmed.match(/^(?:async\s+)?[a-zA-Z0-9_]+\s*\(.*\)\s*{?$/) ||                          // función async
        trimmed.match(/^(?:public|private|protected)\s+(?:async\s+)?[a-zA-Z0-9_]+\s*\(.*\)\s*{?$/) || // métodos de clase con modificadores
        trimmed.match(/^[a-zA-Z0-9_]+\s*\(.*\)\s*:\s*[a-zA-Z<>[\]]+\s*{/)                       // métodos con tipo de retorno
    ) {
        return 'function';
    }

    // Propiedades
    if (
        trimmed.match(/^(?:public|private|protected)?\s*[a-zA-Z0-9_]+\s*[:=]/) ||
        trimmed.match(/^(?:readonly|static)\s+[a-zA-Z0-9_]+/)
    ) {
        return 'property';
    }

    // Por defecto, asumimos que es una función
    return 'function';
}

/**
 * Analiza el contexto de la declaración para determinar si es independiente o parte de una clase/objeto.
 *
 * @param lines - Líneas del archivo
 * @param index - Índice de la línea actual
 * @returns Nivel de anidamiento (0 para declaraciones de nivel superior)
 */
function analyzeContext(lines: string[], index: number): number {
    let bracketCount = 0;

    // Revisa hacia arriba para encontrar nivel de anidamiento
    for (let i = index - 1; i >= 0; i--) {
        const line = lines[i].trim();

        // Cuenta llaves abiertas y cerradas
        const openBrackets = (line.match(/{/g) || []).length;
        const closeBrackets = (line.match(/}/g) || []).length;

        bracketCount += closeBrackets - openBrackets;

        // Si encontramos el nivel de cierre (ya estamos fuera de cualquier bloque)
        if (bracketCount > 0) {
            return 0;
        }

        // Si encontramos una declaración de clase cuando estamos dentro de un bloque
        if (bracketCount < 0 && (line.startsWith('class ') || line.startsWith('interface '))) {
            return Math.abs(bracketCount);
        }
    }

    return 0; // Por defecto, asumimos nivel superior
}

/**
 * Busca la declaración más cercana hacia arriba (metodo/función/propiedad).
 * Esta versión mejorada prioriza la declaración correcta basada en el contexto.
 *
 * @param lines - Líneas del archivo
 * @param startIndex - Índice desde donde buscar hacia arriba
 * @returns El índice de la declaración encontrada y su tipo, o null si no se encuentra
 */
function findDeclarationLine(
    lines: string[],
    startIndex: number
): { index: number; type: keyof typeof rules } | null {
    let i = startIndex;

    // Primero analizamos el contexto para saber el nivel de anidamiento
    const nestingLevel = analyzeContext(lines, startIndex);

    while (i >= 0) {
        const currentLine = lines[i].trim();

        // Si encontramos una declaración válida
        const type = determineDeclarationType(currentLine);

        if (type) {
            // Verificar si hay un bloque de comentarios TSDoc justo antes
            let j = i - 1;
            let foundTSDoc = false;

            // Retroceder saltando líneas en blanco
            while (j >= 0 && lines[j].trim() === '') {
                j--;
            }

            // Buscar el cierre del comentario
            if (j >= 0 && lines[j].trim() === '*/') {
                foundTSDoc = true;
                // Si encontramos el cierre, buscamos la apertura
                while (j >= 0 && !lines[j].trim().startsWith('/**')) {
                    j--;
                }
                // Si encontramos la apertura, esta es la verdadera línea de declaración
                if (j >= 0 && lines[j].trim().startsWith('/**')) {
                    return {
                        index: i,
                        type: type
                    };
                }
            }

            // Si no hay TSDoc y no es una clase anidada
            if (!foundTSDoc && (nestingLevel === 0 || type !== 'class')) {
                return {
                    index: i,
                    type: type
                };
            }
        }

        // Si encontramos una llave de cierre, saltamos el bloque
        if (currentLine === '}') {
            let bracketCount = 1;
            i--;
            while (i >= 0 && bracketCount > 0) {
                const line = lines[i].trim();
                if (line === '}') bracketCount++;
                if (line === '{') bracketCount--;
                i--;
            }
            continue;
        }

        i--;
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
        'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'para', 'por', 'con', 'sin',
        'porque', 'como', 'según', 'cuando', 'si', 'pero', 'aunque', 'mientras', 'hasta',
        'desde', 'entre', 'función', 'archivo', 'línea', 'código', 'método', 'clase',
        'objeto', 'variable', 'valor', 'parámetro', 'devuelve', 'retorna', 'esto', 'español'
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
        return [`Error: La documentación contiene palabras en español: ${foundSpanishWords.join(', ')}.`];
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
function validateDocumentation(
    lines: string[],
    declarationIndex: number,
    type: keyof typeof rules
): string[] {
    // Buscar el comentario TSDoc arriba de la declaración
    let i = declarationIndex - 1;
    let foundComment = false;

    // Saltamos espacios en blanco
    while (i >= 0 && lines[i].trim() === '') {
        i--;
    }

    // Verificar si hay un bloque de comentarios TSDoc
    if (i >= 0 && lines[i].trim() === '*/') {
        foundComment = true;
        // Retroceder hasta encontrar el inicio del comentario
        while (i >= 0 && !lines[i].trim().startsWith('/**')) {
            i--;
        }
    }

    if (!foundComment || i < 0) {
        return [`Error: Falta el bloque TSDoc sobre la declaración de ${type} en línea ${declarationIndex + 1}.`];
    }

    // Validar que el comentario esté en inglés
    const commentBlock = lines.slice(i, declarationIndex).join('\n');
    return validateEnglishDocumentation(commentBlock);
}
/**
 * Válida un archivo verificando la documentación correcta en los cambios.
 *
 * @param filePath - Ruta del archivo.
 * @param changed - Líneas cambiadas.
 * @returns Lista de errores encontrados.
 */
function validateFile(filePath: string, changed: Set<number>): string[] {
    const errors: string[] = [];

    if (!existsSync(filePath)) {
        logDebug(`Archivo eliminado: ${filePath}`);
        return [`Archivo eliminado (informativo): ${filePath}`];
    }

    const fileContent = readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n');

    // Convertimos el Set a un array y ordenamos las líneas para procesarlas en orden
    const changedLinesArray = Array.from(changed).sort((a, b) => a - b);

    // Usamos un Set para llevar registro de las declaraciones ya validadas
    const validatedDeclarations = new Set<number>();

    for (const lineNumber of changedLinesArray) {
        const lineIndex = lineNumber - 1; // Ajuste de índice
        if (lineIndex < 0 || lineIndex >= lines.length) continue;

        logDebug(`Verificando línea cambiada ${lineNumber}: ${lines[lineIndex].trim()}`);

        const declaration = findDeclarationLine(lines, lineIndex);
        if (declaration) {
            // Si ya validamos esta declaración, continuamos
            if (validatedDeclarations.has(declaration.index)) {
                logDebug(`Declaración en línea ${declaration.index + 1} ya validada, saltando.`);
                continue;
            }

            logDebug(`Validando declaración en línea ${declaration.index + 1}: ${lines[declaration.index].trim()}`);
            validatedDeclarations.add(declaration.index);

            const validationErrors = validateDocumentation(
                lines,
                declaration.index,
                declaration.type
            );

            if (validationErrors.length > 0) {
                // Agregamos el número de línea a los errores
                const errorsWithLineNumber = validationErrors.map(
                    err => `${err} (línea ${declaration.index + 1})`
                );
                errors.push(...errorsWithLineNumber);
            }
        } else {
            logDebug(`No se encontró declaración para la línea ${lineNumber}`);
        }
    }

    return errors;
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

            if (file.endsWith('tsdoc-validator.ts') || file.includes('node_modules/'))  {
                continue;
            }

            const fullPath = path.resolve(file);
            logDebug(`Validando archivo: ${fullPath}`);

            const errors = validateFile(fullPath, changedLines[file]);

            if (errors.length > 0) {
                // Filtra errores reales, excluyendo mensajes informativos
                const realErrors = errors.filter(err => !err.includes('Archivo eliminado (informativo)'));

                if (realErrors.length > 0) {
                    errorsByFile[file] = realErrors;
                    totalErrors += realErrors.length;
                    validationResult = false;
                } else {
                    errorsByFile[file] = errors;
                }
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

if (require.main === module) {
    console.log('\n🔍 Validador TSDoc en ejecución (análisis inteligente de documentación)');
    const result = runValidation();
    process.exit(result ? 0 : 1);
}

export { runValidation };