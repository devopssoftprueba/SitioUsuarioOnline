// Importa la función execSync del módulo child_process para ejecutar comandos de terminal
import { execSync } from 'child_process';
// Importa las funciones readFileSync y existsSync del módulo fs para leer archivos y verificar su existencia
import { readFileSync, existsSync } from 'fs';
// Importa todas las funcionalidades del módulo path para manejar rutas de archivos
import * as path from 'path';

const rules = { //objeto en el que defino las reglas que utilizará el script para realizar la validación.
    'class': {
        requiredTags: ['@description'],
        optionalTags: ['@example', '@remarks', '@deprecated']
    },
    'function': {
        requiredTags: ['@param', '@returns'],
        optionalTags: ['@example', '@throws', '@remarks', '@deprecated']
    },
    'property': {
        requiredTags: ['@description'],
        optionalTags: ['@defaultValue', '@remarks', '@deprecated']
    }
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
    console.log(`[${new Date().toISOString()}] ${message}`); //Escribe en la consola el mensaje de error
}

// Imprime un mensaje indicando que el validador TSDoc está en ejecución
logDebug('🔍 Validador TSDoc en ejecución...');

/**
 * Obtiene las líneas modificadas de los archivos en el push actual.
 *
 * @returns Un objeto con los archivos y sus líneas modificadas.
 */
function getChangedLines(): { lines: ChangedLines; functions: Record<string, Set<number>> } {
    try {
        // El código existente para obtener las líneas modificadas se mantiene igual
        const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
        const remoteExists = execSync(`git ls-remote --heads origin ${currentBranch}`, { encoding: 'utf8' }).trim();

        let diffCommand;
        if (remoteExists) {
            diffCommand = `git diff origin/${currentBranch}..HEAD -U3 --no-color`;
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
                        diffCommand = 'git diff --staged -U3 --no-color';
                        logDebug('No se encontró rama remota. Usando cambios preparados (staged).');
                    }
                }
            }

            if (!diffCommand) {
                diffCommand = `git diff origin/${baseBranch}..HEAD -U3 --no-color`;
                logDebug(`Rama nueva detectada. Comparando con ${baseBranch}.`);
            }
        }

        logDebug(`Ejecutando comando diff: ${diffCommand}`);
        const diffOutput = execSync(diffCommand, { encoding: 'utf8' });
        logDebug(`Longitud de la salida diff: ${diffOutput.length} bytes`);

        const changedLines: ChangedLines = {};
        const modifiedFunctions: Record<string, Set<number>> = {};

        const fileRegex = /^diff --git a\/(.+?) b\/(.+)$/;
        const hunkRegex = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;
        const functionStartRegex = /^[\+\-](\s*(?:export\s+)?(?:async\s+)?(?:function|class|interface|const|let|var|public|private|protected))/;

        let currentFile = '';
        let inFunction = false;
        let currentFunctionStartLine = -1;

        const lines = diffOutput.split('\n');
        logDebug(`Procesando ${lines.length} líneas de salida diff`);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            const fileMatch = line.match(fileRegex);
            if (fileMatch) {
                const [, , newFile] = fileMatch;
                currentFile = newFile;
                inFunction = false;
                currentFunctionStartLine = -1;
                continue;
            }

            // Si estamos en un nuevo bloque de diff
            const hunkMatch = line.match(hunkRegex);
            if (hunkMatch && currentFile) {
                const startLine = parseInt(hunkMatch[1], 10);
                const lineCount = hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1;

                const linesSet = changedLines[currentFile] || new Set<number>();
                for (let j = 0; j < lineCount; j++) {
                    linesSet.add(startLine + j);
                }
                changedLines[currentFile] = linesSet;

                // Comprobamos las próximas líneas para ver si identificamos una función completa modificada
                let currentLineNumber = startLine;
                for (let j = i + 1; j < lines.length && (j - i - 1) < lineCount * 2; j++) {
                    const nextLine = lines[j];

                    // Si es una línea del diff que añade o elimina contenido
                    if (nextLine.startsWith('+') || nextLine.startsWith('-')) {
                        // Si parece el inicio de una función o metodo
                        const funcMatch = nextLine.match(functionStartRegex);
                        if (funcMatch) {
                            currentFunctionStartLine = currentLineNumber;
                            inFunction = true;

                            // Registramos la función como modificada
                            const functionsSet = modifiedFunctions[currentFile] || new Set<number>();
                            functionsSet.add(currentFunctionStartLine);
                            modifiedFunctions[currentFile] = functionsSet;
                        }

                        // Si detectamos el inicio de un bloque después de una posible declaración de función
                        if (inFunction && nextLine.includes('{')) {
                            // Confirmamos que estamos dentro de una función
                            const functionsSet = modifiedFunctions[currentFile] || new Set<number>();
                            functionsSet.add(currentFunctionStartLine);
                            modifiedFunctions[currentFile] = functionsSet;
                        }
                    }

                    if (nextLine.startsWith('+')) {
                        currentLineNumber++;
                    }
                }
            }
        }

        logDebug(`Se encontraron cambios en ${Object.keys(changedLines).length} archivos`);
        logDebug(`Se detectaron modificaciones en ${Object.values(modifiedFunctions).reduce((sum, set) => sum + set.size, 0)} funciones/métodos`);

        return { lines: changedLines, functions: modifiedFunctions };
    } catch (error) {
        logDebug(`Error al obtener líneas cambiadas: ${error}`);
        return { lines: {}, functions: {} };
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

    // Mejoramos la detección de clases e interfaces
    if (
        trimmed.startsWith('class ') ||
        trimmed.startsWith('interface ') ||
        trimmed.match(/^export\s+(class|interface)\s+/) ||
        trimmed.match(/^export\s+default\s+(class|interface)/)
    ) {
        return 'class';
    }
    // Mejoramos la detección de funciones
    else if (
        trimmed.startsWith('function ') ||
        trimmed.match(/^(?:async\s+)?[a-zA-Z0-9_]+\s*\(.*\)\s*{?$/) ||
        trimmed.match(/^(?:public|private|protected)\s+(?:async\s+)?[a-zA-Z0-9_]+\s*\(.*\)\s*{?$/) ||
        trimmed.match(/^export\s+(?:async\s+)?function\s+[a-zA-Z0-9_]+/) ||
        trimmed.match(/^export\s+default\s+(?:async\s+)?function/) ||
        (trimmed.startsWith('const ') || trimmed.startsWith('let ') || trimmed.startsWith('var ')) &&
        (trimmed.includes(' = function') || trimmed.includes(' = async function') ||
            trimmed.includes(' = (') || trimmed.includes(' = async ('))
    ) {
        return 'function';
    }
    // Mejoramos la detección de propiedades
    else if (
        trimmed.match(/^(?:public|private|protected|readonly|static)?\s*[a-zA-Z0-9_]+\s*[:=]/) ||
        trimmed.match(/^(?:readonly|static)\s+[a-zA-Z0-9_]+/) ||
        (trimmed.startsWith('const ') || trimmed.startsWith('let ') || trimmed.startsWith('var ')) &&
        !trimmed.includes(' = function') && !trimmed.includes(' = (') &&
        !trimmed.includes(' = async')
    ) {
        return 'property';
    }

    return 'function'; // Por defecto asumimos función
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
    // Primero intentamos encontrar una declaración en la línea actual
    const currentLine = lines[startIndex].trim();

    // Si la línea actual parece ser una declaración, la devolvemos directamente
    if (
        currentLine.startsWith('class ') ||
        currentLine.startsWith('interface ') ||
        currentLine.startsWith('function ') ||
        currentLine.startsWith('public ') ||
        currentLine.startsWith('private ') ||
        currentLine.startsWith('protected ') ||
        currentLine.startsWith('static ') ||
        currentLine.startsWith('readonly ') ||
        currentLine.startsWith('const ') && (currentLine.includes(' = function') || currentLine.includes(' = (') || currentLine.includes(' = async')) ||
        currentLine.startsWith('let ') && (currentLine.includes(' = function') || currentLine.includes(' = (') || currentLine.includes(' = async')) ||
        currentLine.startsWith('var ') && (currentLine.includes(' = function') || currentLine.includes(' = (') || currentLine.includes(' = async')) ||
        /^[a-zA-Z0-9_]+\s*\(.*\)\s*{?$/.test(currentLine) ||
        /^async\s+[a-zA-Z0-9_]+\s*\(.*\)\s*{?$/.test(currentLine)
    ) {
        return {
            index: startIndex,
            type: determineDeclarationType(currentLine)
        };
    }

    // Si no encontramos una declaración en la línea actual, buscamos hacia arriba
    for (let i = startIndex; i >= 0; i--) {
        const trimmed = lines[i].trim();

        // Ignoramos comentarios y líneas vacías
        if (trimmed.startsWith('/**') || trimmed.startsWith('*') || trimmed === '*/' || trimmed === '') {
            continue;
        }

        // Ignoramos decoradores
        if (trimmed.startsWith('@')) {
            continue;
        }

        // Si encontramos un cierre de bloque, algo como "}" solo en la línea, saltamos al bloque superior
        if (trimmed === '}') {
            let openBrackets = 1;
            // Buscamos la apertura del bloque correspondiente
            for (let j = i - 1; j >= 0; j--) {
                const bracketLine = lines[j].trim();
                if (bracketLine === '}') {
                    openBrackets++;
                } else if (bracketLine === '{') {
                    openBrackets--;
                    if (openBrackets === 0) {
                        // Encontramos la apertura del bloque, ahora buscamos la declaración
                        i = j;
                        break;
                    }
                }
            }
            continue;
        }

        // Si parece una declaración, la devolvemos
        if (
            trimmed.startsWith('class ') ||
            trimmed.startsWith('interface ') ||
            trimmed.startsWith('function ') ||
            /^[a-zA-Z0-9_]+\s*\(.*\)\s*{?$/.test(trimmed) ||
            trimmed.startsWith('public ') ||
            trimmed.startsWith('private ') ||
            trimmed.startsWith('protected ') ||
            /^[a-zA-Z0-9_]+\s*[:=]/.test(trimmed) ||
            trimmed.startsWith('const ') && (trimmed.includes(' = function') || trimmed.includes(' = (') || trimmed.includes(' = async')),
            trimmed.startsWith('let ') && (trimmed.includes(' = function') || trimmed.includes(' = (') || trimmed.includes(' = async')),
            trimmed.startsWith('var ') && (trimmed.includes(' = function') || trimmed.includes(' = (') || trimmed.includes(' = async')),
                /^export\s+(function|class|interface|const|var|let)/.test(trimmed),
                /^async\s+[a-zA-Z0-9_]+\s*\(.*\)\s*{?$/.test(trimmed)
        ) {
            return {
                index: i,
                type: determineDeclarationType(trimmed)
            };
        }
    }

    return null;
}
/**
 * Verifica si la documentación está en inglés.
 *
 * @param commentBlock - El bloque de comentarios TSDoc a verificar
 * @returns Array de errores si no está en inglés, array vacío si es válido
 */
function validateEnglishDocumentation(commentBlock: string): string[] { // Función que válida que un bloque de comentario esté redactado en inglés, detectando palabras en español. Retorna errores si encuentra contenido en español.

    const spanishWords = [ //glosario de palabras auxiliares para detectar que la documentación está en español.
        'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
        'para', 'por', 'con', 'sin', 'porque', 'como', 'según', 'cuando',
        'si', 'pero', 'aunque', 'mientras', 'hasta', 'desde', 'entre',
        'función', 'archivo', 'línea', 'código', 'método', 'clase',
        'objeto', 'variable', 'valor', 'parámetro', 'devuelve', 'retorna',
        'pongo', 'esto', 'aquí', 'ese', 'esa','eso', 'español', 'área', 'círculo', 'fórmula'
    ];

    const cleanedComment = commentBlock // Se limpia el bloque de comentarios para facilitar la búsqueda.
        .split('\n') // Divide el bloque en líneas individuales.
        .map(line => line.trim().replace(/^\*\s*/, '')) // Quito espacio y asteriscos de cada línea.
        .join(' ') // Une todas las líneas en una sola cadena.
        .toLowerCase(); // Convierte el texto a minúsculas para una comparación insensible a mayúsculas.

    const foundSpanishWords = spanishWords.filter(word => {  // Filtra las palabras en español que estén presentes en el comentario.
        const regex = new RegExp(`\\b${word}\\b`, 'i'); // Crea una expresión regular para buscar la palabra completa (con límites de palabra).
        return regex.test(cleanedComment); // Verifica si esa palabra existe en el comentario.
    });

    if (foundSpanishWords.length > 0) {  // Si se detectaron palabras en español...
        return [`Error: La documentación parece estar en español. Palabras detectadas: ${foundSpanishWords.join(', ')}. La documentación debe estar en inglés.`];
    }

    return []; // Si no se detectaron palabras en español, no hay errores.
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
    let i = declarationIndex - 1;

    // Saltamos líneas en blanco, imports y decoradores
    while (i >= 0) {
        const trimmedLine = lines[i].trim();

        // Si encontramos otra declaración o código ejecutable antes de un bloque de comentarios
        // significa que la declaración actual no tiene documentación
        if (trimmedLine !== '' &&
            !trimmedLine.startsWith('@') && // Saltamos decoradores
            !trimmedLine.startsWith('import ') && // Saltamos imports
            !trimmedLine.startsWith('//') && // Saltamos comentarios de línea
            !trimmedLine.startsWith('*/') && // Saltamos cierres de comentario
            !trimmedLine.match(/^\s*$/) // Saltamos líneas en blanco
        ) {
            // Si llegamos a código que no es comentario, imports o decoradores,
            // no hay documentación asociada
            return [`Error: Falta el bloque TSDoc sobre la declaración de ${type}.`];
        }

        // Si encontramos un cierre de comentario, es probable que sea nuestra documentación
        if (trimmedLine === '*/') {
            break;
        }

        i--;
    }

    // Si llegamos al inicio del archivo sin encontrar documentación
    if (i < 0) {
        return [`Error: Falta el bloque TSDoc sobre la declaración de ${type}.`];
    }

    // Ahora buscamos el inicio del bloque de comentarios
    let startCommentIndex = i;
    while (startCommentIndex >= 0 && !lines[startCommentIndex].trim().startsWith('/**')) {
        startCommentIndex--;
    }

    if (startCommentIndex < 0) {
        return [`Error: Se encontró un cierre de comentario sin apertura para la declaración de ${type}.`];
    }

    const commentBlock = lines.slice(startCommentIndex, i + 1).join('\n');
    const errors: string[] = [];

    const originalDeclaration = lines[declarationIndex];

    // El resto de la validación (parámetros, retornos, idioma) queda igual
    if (type === 'function' || type === 'class') {
        const hasParameters = originalDeclaration.includes('(') &&
            !originalDeclaration.includes('()') &&
            !originalDeclaration.includes('( )');

        if (hasParameters && !commentBlock.includes('@param')) {
            errors.push(`Error: La declaración tiene parámetros pero falta documentación con etiquetas @param.`);
        }

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
function validateFile(filePath: string, changed: Set<number>, modifiedFunctions: Set<number> = new Set()): string[] {
    const errors: string[] = [];

    try {
        if (!existsSync(filePath)) {
            logDebug(`Archivo eliminado: ${filePath}`);
            return [`Archivo eliminado (informativo): ${filePath}`];
        }

        const fileContent = readFileSync(filePath, 'utf8');
        const lines = fileContent.split('\n');

        const declarations: Array<{ index: number; type: keyof typeof rules }> = [];

        // Primero procesamos las líneas específicas modificadas
        changed.forEach(lineNumber => {
            const lineIndex = lineNumber - 1;
            if (lineIndex < 0 || lineIndex >= lines.length) return;

            logDebug(`Verificando línea cambiada ${lineNumber}: ${lines[lineIndex].trim()}`);

            const declaration = findDeclarationLine(lines, lineIndex);
            if (!declaration) {
                logDebug(`No se encontró declaración para la línea ${lineNumber}`);
                return;
            }

            // Verificamos si esta declaración ya está en la lista o si debe ser incluida
            const alreadyIncluded = declarations.some(d => d.index === declaration.index);
            if (!alreadyIncluded) {
                declarations.push(declaration);
                logDebug(`Declaración encontrada en línea ${declaration.index + 1}: ${lines[declaration.index].trim()}`);
            }
        });

        // Ahora procesamos las funciones modificadas identificadas
        modifiedFunctions.forEach(lineNumber => {
            const lineIndex = lineNumber - 1;
            if (lineIndex < 0 || lineIndex >= lines.length) return;

            logDebug(`Verificando función modificada en línea ${lineNumber}: ${lines[lineIndex].trim()}`);

            // Verificamos si ya está incluida
            const alreadyIncluded = declarations.some(d => d.index === lineIndex);
            if (!alreadyIncluded) {
                // Determinamos el tipo de la declaración
                const type = determineDeclarationType(lines[lineIndex]);
                declarations.push({ index: lineIndex, type });
                logDebug(`Función modificada añadida para validación: ${type} en línea ${lineIndex + 1}`);
            }
        });

        // Validamos todas las declaraciones encontradas
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
        const { lines: changedLines, functions: modifiedFunctions } = getChangedLines();
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
                continue;
            }

            const fullPath = path.resolve(file);
            logDebug(`Validando archivo: ${fullPath}`);

            // Obtenemos las funciones modificadas para este archivo
            const fileFunctions = modifiedFunctions[file] || new Set<number>();
            const errors = validateFile(fullPath, changedLines[file], fileFunctions);

            if (errors.length > 0) {
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

        // El resto del código de presentación de errores permanece igual
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

if (require.main === module) { // Verifica si este archivo se está ejecutando directamente
    console.log('\n🔍 Validador TSDoc en ejecución (análisis inteligente de documentación)');

    const result = runValidation(); // Ejecuta la validación
    process.exit(result ? 0 : 1); // Finaliza el proceso con código 0 si éxito, 1 si error
}

export { runValidation };// Exporta la función para ser usada desde otros archivos