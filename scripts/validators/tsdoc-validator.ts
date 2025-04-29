// Importa la función execSync del módulo child_process para ejecutar comandos de terminal
import { execSync } from 'child_process';
// Importa las funciones readFileSync y existsSync del módulo fs para leer archivos y verificar su existencia
import { readFileSync, existsSync } from 'fs';
// Importa todas las funcionalidades del módulo path para manejar rutas de archivos
import * as path from 'path';
// Importa las reglas de validación TSDoc desde el archivo local tsdoc-rules
import rules from './tsdoc-rules';

// Define un tipo ChangedLines que es un objeto con claves string y valores Set<number> para almacenar líneas modificadas por archivo
type ChangedLines = Record<string, Set<number>>;

/**
 * Log with timestamp for debugging
 *
 * @param message - The message to log
 */
// Función que imprime mensajes de debug con timestamp para facilitar la depuración
function logDebug(message: string): void {
    // Imprime un mensaje con formato [timestamp] mensaje
    console.log(`[${new Date().toISOString()}] ${message}`);
}

// Imprime un mensaje indicando que el validador TSDoc está en ejecución
logDebug('🔍 TSDoc validator running...');

/**
 * Gets the modified lines from files in the current push.
 *
 * @returns An object with files and their modified lines.
 */
// Función que detecta las líneas modificadas en los archivos del push actual
function getChangedLines(): ChangedLines {
    try {
        // Obtiene el nombre de la rama actual ejecutando un comando git
        const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();

        // Verifica si la rama actual existe en el repositorio remoto
        const remoteExists = execSync(`git ls-remote --heads origin ${currentBranch}`, { encoding: 'utf8' }).trim();

        // Variable para almacenar el comando git diff que se ejecutará
        let diffCommand;
        // Si la rama existe en el remoto, compara con ella
        if (remoteExists) {
            // Establece el comando para comparar con la rama remota
            diffCommand = `git diff origin/${currentBranch}..HEAD -U0 --no-color`;
            // Registra qué rama se está comparando
            logDebug(`Comparing with remote branch: origin/${currentBranch}`);
        } else {
            // Si es una rama nueva, busca cambios comparando con una rama base
            // Primero intentará encontrar main, luego master, luego develop
            let baseBranch = 'main';
            try {
                // Intenta verificar si existe origin/main
                execSync('git rev-parse --verify origin/main', { stdio: 'pipe' });
            } catch (e) {
                try {
                    // Si no existe main, intenta verificar si existe origin/master
                    execSync('git rev-parse --verify origin/master', { stdio: 'pipe' });
                    // Si existe master, la usa como rama base
                    baseBranch = 'master';
                } catch (e) {
                    try {
                        // Si no existe master, intenta verificar si existe origin/develop
                        execSync('git rev-parse --verify origin/develop', { stdio: 'pipe' });
                        // Si existe develop, la usa como rama base
                        baseBranch = 'develop';
                    } catch (e) {
                        // Si no se encuentra ninguna rama base, usa los cambios staged
                        diffCommand = 'git diff --staged -U0 --no-color';
                        // Registra que no se encontró una rama remota
                        logDebug('No remote branch found. Using staged changes.');
                    }
                }
            }

            // Si no se ha establecido el comando diff (porque se encontró una rama base)
            if (!diffCommand) {
                // Establece el comando para comparar con la rama base encontrada
                diffCommand = `git diff origin/${baseBranch}..HEAD -U0 --no-color`;
                // Registra la rama base con la que se está comparando
                logDebug(`New branch detected. Comparing with ${baseBranch}.`);
            }
        }

        // Registra el comando diff que se va a ejecutar
        logDebug(`Running diff command: ${diffCommand}`);
        // Ejecuta el comando diff y almacena la salida
        const diffOutput = execSync(diffCommand, { encoding: 'utf8' });
        // Registra el tamaño de la salida del comando diff
        logDebug(`Diff output length: ${diffOutput.length} bytes`);

        // Objeto para almacenar los archivos modificados y sus líneas cambiadas
        const changedLines: ChangedLines = {};

        // Expresión regular para extraer los nombres de archivos del diff
        const fileRegex = /^diff --git a\/(.+?) b\/(.+)$/;
        // Expresión regular para extraer la información de líneas modificadas
        const hunkRegex = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

        // Variable para almacenar el archivo que se está procesando actualmente
        let currentFile = '';

        // Divide la salida del diff en líneas
        const lines = diffOutput.split('\n');
        // Registra cuántas líneas de diff se van a procesar
        logDebug(`Processing ${lines.length} lines of diff output`);

        // Recorre cada línea del diff
        for (const line of lines) {
            // Verifica si la línea contiene información sobre un archivo
            const fileMatch = line.match(fileRegex);
            if (fileMatch) {
                // Extrae el nombre del nuevo archivo y lo almacena como archivo actual
                const [, , newFile] = fileMatch;
                currentFile = newFile;
                // Continúa con la siguiente línea
                continue;
            }

            // Verifica si la línea contiene información sobre un fragmento modificado (hunk)
            const hunkMatch = line.match(hunkRegex);
            if (hunkMatch && currentFile) {
                // Extrae la línea inicial y la cantidad de líneas modificadas
                const startLine = parseInt(hunkMatch[1], 10);
                const lineCount = hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1;
                // Obtiene o crea un conjunto para almacenar las líneas modificadas del archivo actual
                const linesSet = changedLines[currentFile] || new Set<number>();
                // Añade cada línea modificada al conjunto
                for (let i = 0; i < lineCount; i++) {
                    linesSet.add(startLine + i);
                }
                // Actualiza el registro de líneas modificadas para el archivo actual
                changedLines[currentFile] = linesSet;
            }
        }

        // Registra cuántos archivos tienen cambios
        logDebug(`Found changes in ${Object.keys(changedLines).length} files`);
        // Devuelve el objeto con los archivos y sus líneas modificadas
        return changedLines;
    } catch (error) {
        // Registra cualquier error que ocurra al obtener las líneas modificadas
        logDebug(`Error getting changed lines: ${error}`);
        // En caso de error, devuelve un objeto vacío
        return {};
    }
}

/**
 * Determines the declaration type based on the code line.
 *
 * @param line - Code line to analyze
 * @returns The identified declaration type
 */
// Función que analiza una línea de código y determina qué tipo de declaración es (clase, función o propiedad)
function determineDeclarationType(line: string): keyof typeof rules {
    // Elimina espacios al inicio y final de la línea
    const trimmed = line.trim();

    // Si la línea comienza con 'class' o 'interface', es una declaración de clase
    if (trimmed.startsWith('class ') || trimmed.startsWith('interface ')) {
        return 'class';
    } else if (
        // Si la línea comienza con 'function' o es un metodo (con o sin async, con o sin modificadores de acceso)
        trimmed.startsWith('function ') ||
        trimmed.match(/^(?:async\s+)?[a-zA-Z0-9_]+\s*\(.*\)\s*{?$/) ||
        trimmed.match(/^(?:public|private|protected)\s+(?:async\s+)?[a-zA-Z0-9_]+\s*\(.*\)\s*{?$/)
    ) {
        return 'function';
    } else if (
        // Si la línea es una propiedad (con o sin modificadores de acceso, con: o =)
        trimmed.match(/^(?:public|private|protected)?\s*[a-zA-Z0-9_]+\s*[:=]/) ||
        trimmed.match(/^(?:readonly|static)\s+[a-zA-Z0-9_]+/)
    ) {
        return 'property';
    }

    // Por defecto, asume que es una función
    return 'function'; // Default fallback
}

/**
 * Searches for the closest class/method/property declaration upwards.
 *
 * @param lines - File lines.
 * @param startIndex - Index from where to search upwards.
 * @returns The index of the found declaration and its type, or null if not found.
 */
// Función que busca la declaración más cercana (clase, metodo o propiedad) analizando hacia arriba desde una línea dada
function findDeclarationLine(lines: string[], startIndex: number): { index: number; type: keyof typeof rules } | null {
    // Recorre las líneas desde el índice inicial hacia arriba
    for (let i = startIndex; i >= 0; i--) {
        // Elimina espacios al inicio y final de la línea
        const trimmed = lines[i].trim();
        // Verifica si la línea es una declaración de clase, interfaz, función, metodo o propiedad
        if (
            trimmed.startsWith('class ') ||
            trimmed.startsWith('interface ') ||
            trimmed.startsWith('function ') ||
            trimmed.match(/^[a-zA-Z0-9_]+\s*\(.*\)\s*{?$/) || // métodos
            trimmed.startsWith('public ') ||
            trimmed.startsWith('private ') ||
            trimmed.startsWith('protected ') ||
            trimmed.match(/^[a-zA-Z0-9_]+\s*[:=]/) // propiedades
        ) {
            // Si encuentra una declaración, devuelve su índice y tipo
            return {
                index: i,
                type: determineDeclarationType(trimmed)
            };
        }
    }
    // Si no encuentra ninguna declaración, devuelve null
    return null;
}

/**
 * Checks if the documentation is in English.
 *
 * @param commentBlock - The TSDoc comment block to check
 * @returns Array of errors if not in English, empty array if valid
 */
// Función que verifica si la documentación está en inglés
function validateEnglishDocumentation(commentBlock: string): string[] {
    // Lista de palabras comunes en español que no deberían aparecer en documentación en inglés
    const spanishWords = [
        'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
        'para', 'por', 'con', 'sin', 'porque', 'como', 'según', 'cuando',
        'si', 'pero', 'aunque', 'mientras', 'hasta', 'desde', 'entre',
        'función', 'archivo', 'línea', 'código', 'método', 'clase',
        'objeto', 'variable', 'valor', 'parámetro', 'devuelve', 'retorna'
    ];

    // Elimina asteriscos y espacios iniciales de cada línea del comentario
    const cleanedComment = commentBlock
        .split('\n')
        .map(line => line.trim().replace(/^\*\s*/, ''))
        .join(' ')
        .toLowerCase();

    // Busca palabras en español en el comentario
    const foundSpanishWords = spanishWords.filter(word => {
        // Busca la palabra con límites de palabra para no encontrar coincidencias parciales
        const regex = new RegExp(`\\b${word}\\b`, 'i');
        return regex.test(cleanedComment);
    });

    // Si encuentra palabras en español, devuelve un error
    if (foundSpanishWords.length > 0) {
        return [`Error: La documentación parece estar en español. Palabras detectadas: ${foundSpanishWords.join(', ')}. La documentación debe estar en inglés.`];
    }

    // Si no encuentra palabras en español, asume que está en inglés
    return [];
}

/**
 * Verifies if a valid TSDoc comment block exists for a declaration.
 *
 * @param lines - File lines
 * @param declarationIndex - Index where the declaration is
 * @param type - Declaration type
 * @returns List of found errors
 */
// Función que verifica si una declaración tiene la documentación TSDoc correcta
function validateDocumentation(lines: string[], declarationIndex: number, type: keyof typeof rules): string[] {
    // Busca hacia arriba para encontrar un bloque de comentarios
    let i = declarationIndex - 1;

    // Salta líneas vacías entre la declaración y el posible comentario
    while (i >= 0 && lines[i].trim() === '') {
        i--;
    }

    // Si no hay línea previa o no es un cierre de comentario, indica error
    if (i < 0 || lines[i].trim() !== '*/') {
        return [`Error: Missing TSDoc block above the ${type} declaration.`];
    }

    // Busca el inicio del bloque de comentarios (/**) retrocediendo líneas
    let startCommentIndex = i;
    while (startCommentIndex >= 0 && !lines[startCommentIndex].trim().startsWith('/**')) {
        startCommentIndex--;
    }

    // Si no encuentra el inicio del comentario, indica error
    if (startCommentIndex < 0) {
        return [`Error: Comment closing found without opening for ${type} declaration.`];
    }

    // Extrae el bloque completo de comentarios uniendo todas las líneas
    const commentBlock = lines.slice(startCommentIndex, i + 1).join('\n');

    // Obtiene las etiquetas requeridas para este tipo de declaración desde las reglas
    const requiredTags = typeof rules[type] === 'object' && rules[type] !== null && 'requiredTags' in rules[type]
        ? (rules[type] as { requiredTags: string[] }).requiredTags
        : [];
    // Verifica qué etiquetas requeridas faltan en el bloque de comentarios
    const missingTags = requiredTags.filter(tag => !commentBlock.includes(tag));

    // Lista para almacenar todos los errores encontrados
    const errors: string[] = [];

    // Si faltan etiquetas, indica cuáles
    if (missingTags.length > 0) {
        errors.push(`Error: The ${type} declaration is missing the following tags: ${missingTags.join(', ')}.`);
    }

    // Válida que la documentación esté en inglés
    const languageErrors = validateEnglishDocumentation(commentBlock);
    // Añade los errores de idioma si los hay
    if (languageErrors.length > 0) {
        errors.push(...languageErrors);
    }

    // Devuelve la lista completa de errores
    return errors;
}

/**
 * Validates a file by checking correct documentation in changes.
 *
 * @param filePath - File path.
 * @param changed - Changed lines.
 * @returns List of found errors.
 */
// Función que valida un archivo específico, verificando la documentación de las líneas modificadas
function validateFile(filePath: string, changed: Set<number>): string[] {
    try {
        // Verifica si el archivo existe
        if (!existsSync(filePath)) {
            // Si no existe, registra el error y lo devuelve
            logDebug(`File not found: ${filePath}`);
            return [`Error: File not found - ${filePath}`];
        }

        // Lee el contenido del archivo
        const fileContent = readFileSync(filePath, 'utf8');
        // Divide el contenido en líneas
        const lines = fileContent.split('\n');
        // Inicializa un array para almacenar errores
        const errors: string[] = [];

        // Conjunto para evitar validar la misma declaración múltiples veces
        const alreadyValidated = new Set<number>();

        // Para cada línea modificada
        changed.forEach(lineNumber => {
            // Ajusta el número de línea al índice del array (restando 1)
            const lineIndex = lineNumber - 1;
            // Verifica que el índice sea válido
            if (lineIndex < 0 || lineIndex >= lines.length) return;

            // Busca la declaración asociada con esta línea
            const declaration = findDeclarationLine(lines, lineIndex);
            // Si no encuentra una declaración, continúa con la siguiente línea
            if (!declaration) return;

            // Extrae el índice y tipo de la declaración
            const { index: declarationIndex, type } = declaration;

            // Si ya validó esta declaración, la omite
            if (alreadyValidated.has(declarationIndex)) return;
            // Marca esta declaración como validada
            alreadyValidated.add(declarationIndex);

            // Registra qué declaración está validando
            logDebug(`Validating ${type} at line ${declarationIndex + 1} in ${filePath}`);

            // Valida la documentación de la declaración
            const validationErrors = validateDocumentation(lines, declarationIndex, type);
            // Si hay errores de validación, los agrega a la lista
            if (validationErrors.length > 0) {
                // Añade la línea de código donde está el error
                const codeLine = lines[declarationIndex].trim();
                errors.push(`Error on line ${declarationIndex + 1}: ${codeLine}`);
                // Añade los mensajes de error con formato
                errors.push(...validationErrors.map(e => `  - ${e}`));
            }
        });

        // Devuelve la lista de errores encontrados
        return errors;

    } catch (error) {
        // Si ocurre algún error durante la validación, lo registra y devuelve
        logDebug(`Error validating file ${filePath}: ${error}`);
        return [`Error validating file ${filePath}: ${error}`];
    }
}

/**
 * Runs validation on all files with changes.
 *
 * @returns True if validation passes, false if there are errors.
 */
// Función principal que ejecuta la validación en todos los archivos modificados
function runValidation(): boolean {
    try {
        // Obtiene las líneas modificadas de todos los archivos
        const changedLines = getChangedLines();

        // Inicializa la variable de resultado (true = validación exitosa)
        let validationResult = true;
        // Inicializa el array para almacenar todos los errores
        const allErrors: string[] = [];

        // Para cada archivo con líneas modificadas
        for (const file in changedLines) {
            // Omite archivos que no son JavaScript o TypeScript
            if (
                !file.endsWith('.ts') &&
                !file.endsWith('.tsx') &&
                !file.endsWith('.js') &&
                !file.endsWith('.jsx')
            ) {
                // Registra qué archivos se omiten
                logDebug(`Skipping non-JavaScript/TypeScript file: ${file}`);
                continue;
            }

            // Omite el propio validador y archivos de node_modules
            if (file.endsWith('tsdoc-validator.ts') || file.includes('node_modules/')) {
                // Registra qué archivos excluidos se omiten
                logDebug(`Skipping excluded file: ${file}`);
                continue;
            }

            // Obtiene la ruta completa del archivo
            const fullPath = path.resolve(file);
            // Registra qué archivo se está validando
            logDebug(`Validating file: ${fullPath}`);

            // Válida el archivo y obtiene los errores
            const errors = validateFile(fullPath, changedLines[file]);

            // Si hay errores, los agrega a la lista general
            if (errors.length > 0) {
                allErrors.push(`\nFile: ${file}`);
                allErrors.push(...errors);
                // Marca la validación como fallida
                validationResult = false;
            }
        }

        // Si la validación falló, muestra los errores
        if (!validationResult) {
            console.log('\n⚠️  TSDoc validation errors found:');
            allErrors.forEach(error => console.log(error));
            console.log(`\nTotal errors: ${allErrors.length}`);
            console.log('\nPlease ensure all new declarations are properly documented in English.');
        } else {
            // Si la validación fue exitosa, registra un mensaje de éxito
            logDebug('✅ TSDoc validation completed without errors.');
        }

        // Devuelve el resultado de la validación
        return validationResult;
    } catch (error) {
        // Si ocurre algún error durante la validación, lo registra y falla la validación
        logDebug(`Validation error: ${error}`);
        console.error(`\n⚠️  TSDoc validation error: ${error}`);
        return false; // En caso de error, bloqueamos el push
    }
}

// Si este archivo se ejecuta directamente (no es importado)
if (require.main === module) {
    // Ejecuta la validación y almacena el resultado
    const result = runValidation();
    // Sale con código 0 (éxito) o 1 (error) según el resultado
    process.exit(result ? 0 : 1);
}

// Exporta la función runValidation para poder usarla en otros archivos
export { runValidation };