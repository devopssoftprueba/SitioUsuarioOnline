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
 * Logs a debug message with timestamp
 *
 * @param message - The message to log
 * @remarks This function helps track the validator's execution flow
 * @public
 */
function logDebug(message: string): void {
    // Imprime un mensaje con formato [timestamp] mensaje
    console.log(`[${new Date().toISOString()}] ${message}`);
}

// Imprime un mensaje indicando que el validador TSDoc está en ejecución
logDebug('🔍 TSDoc validator running...');

/**
 * Gets the changed lines from files in the current push
 *
 * @returns An object with files and their modified lines
 * @remarks This function uses git diff to identify changes between branches
 * @throws Will throw an error if git commands fail
 * @public
 */
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
 * Determines the declaration type based on code line
 *
 * @param line - Code line to analyze
 * @returns The identified declaration type
 * @remarks Uses regex patterns to identify classes, functions, and properties
 * @public
 */
function determineDeclarationType(line: string): keyof typeof rules {
    // Elimina espacios al inicio y final de la línea
    const trimmed = line.trim();

    // Si la línea comienza con 'class', 'interface', 'enum' o 'namespace', es una declaración de clase/módulo
    if (
        trimmed.startsWith('class ') ||
        trimmed.startsWith('interface ') ||
        trimmed.startsWith('enum ') ||
        trimmed.startsWith('namespace ')
    ) {
        return 'class';
    } else if (
        // Si la línea comienza con 'function' o es un metodo (con o sin async, con o sin modificadores de acceso)
        trimmed.startsWith('function ') ||
        trimmed.match(/^(?:async\s+)?[a-zA-Z0-9_]+\s*\(.*\)\s*(?::\s*\w+\s*)?(?:=>\s*|\{)/) ||
        trimmed.match(/^(?:public|private|protected|abstract|static)\s+(?:async\s+)?[a-zA-Z0-9_]+\s*\(.*\)\s*(?::\s*\w+\s*)?(?:=>\s*|\{)/)
    ) {
        return 'function';
    } else if (
        // Si la línea es una propiedad (con o sin modificadores de acceso, con: o =)
        trimmed.match(/^(?:public|private|protected|readonly|static)?\s*[a-zA-Z0-9_]+\s*(?::\s*\w+)?\s*[:=]/) ||
        trimmed.match(/^(?:readonly|static)\s+[a-zA-Z0-9_]+/)
    ) {
        return 'property';
    }

    // Por defecto, asume que es una función
    return 'function'; // Default fallback
}

/**
 * Finds the nearest class/method/property declaration going upward
 *
 * @param lines - File lines
 * @param startIndex - Index from which to search upward
 * @returns The index of the found declaration and its type, or null if none found
 * @remarks Helps identify the declaration associated with the current line
 * @public
 */
function findDeclarationLine(lines: string[], startIndex: number): { index: number; type: keyof typeof rules } | null {
    // Recorre las líneas desde el índice inicial hacia arriba
    for (let i = startIndex; i >= 0; i--) {
        // Elimina espacios al inicio y final de la línea
        const trimmed = lines[i].trim();
        // Verifica si la línea es una declaración de clase, interfaz, función, metodo o propiedad
        if (
            trimmed.startsWith('class ') ||
            trimmed.startsWith('interface ') ||
            trimmed.startsWith('enum ') ||
            trimmed.startsWith('namespace ') ||
            trimmed.startsWith('function ') ||
            trimmed.match(/^[a-zA-Z0-9_]+\s*\(.*\)\s*(?::\s*\w+\s*)?(?:=>\s*|\{)/) || // métodos
            trimmed.startsWith('public ') ||
            trimmed.startsWith('private ') ||
            trimmed.startsWith('protected ') ||
            trimmed.startsWith('readonly ') ||
            trimmed.startsWith('static ') ||
            trimmed.match(/^[a-zA-Z0-9_]+\s*(?::\s*\w+)?\s*[:=]/) // propiedades
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
 * Checks if the documentation is written in English
 *
 * @param commentBlock - The entire documentation comment block
 * @returns An error message if Spanish is detected, or empty string if it passes
 * @remarks Uses a simple word frequency detection to identify Spanish documentation
 * @public
 */
function validateLanguage(commentBlock: string): string {
    // Si no se requiere validación en inglés, retorna vacío
    if (!rules.enforceEnglish) {
        return '';
    }

    // Lista de palabras comunes en español para detectar
    const spanishWords = rules.spanishWords || [];

    // Normaliza el texto para análisis
    const normalizedText = commentBlock.toLowerCase();

    // Cuenta cuántas palabras en español aparecen en el comentario
    let spanishWordCount = 0;
    for (const word of [...spanishWords]) {
        // Busca la palabra con límites de palabra (no como parte de otras palabras)
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const matches = normalizedText.match(regex);
        if (matches) {
            spanishWordCount += matches.length;
        }
    }

    // Si hay más de 3 palabras en español, es probable que la documentación no esté en inglés
    if (spanishWordCount > 3) {
        return 'Error: Documentation appears to be in Spanish. Please write documentation in English.';
    }

    return '';
}

/**
 * Verifies if a valid TSDoc documentation block exists for a declaration
 *
 * @param lines - File lines
 * @param declarationIndex - Index where the declaration is located
 * @param type - Type of declaration
 * @returns List of errors found
 * @remarks Checks for required tags and proper format according to TSDoc standard
 * @throws Will not throw but returns errors as strings
 * @public
 */
function validateDocumentation(lines: string[], declarationIndex: number, type: keyof typeof rules): string[] {
    // Busca hacia arriba para encontrar un bloque de comentarios
    let i = declarationIndex - 1;

    // Salta líneas vacías entre la declaración y el posible comentario
    while (i >= 0 && lines[i].trim() === '') {
        i--;
    }

    // Si no hay línea previa o no es un cierre de comentario, indica error
    if (i < 0 || lines[i].trim() !== '*/') {
        return [`Error: Missing TSDoc block above ${type} declaration.`];
    }

    // Busca el inicio del bloque de comentarios (/**) retrocediendo líneas
    let startCommentIndex = i;
    while (startCommentIndex >= 0 && !lines[startCommentIndex].trim().startsWith('/**')) {
        startCommentIndex--;
    }

    // Si no encuentra el inicio del comentario, indica error
    if (startCommentIndex < 0) {
        return [`Error: Found comment closing without opening for ${type} declaration.`];
    }

    // Extrae el bloque completo de comentarios uniendo todas las líneas
    const commentBlock = lines.slice(startCommentIndex, i + 1).join('\n');

    // Lista para almacenar todos los errores encontrados
    const errors: string[] = [];

    // Verifica el idioma (inglés)
    const languageError = validateLanguage(commentBlock);
    if (languageError) {
        errors.push(languageError);
    }

    // Obtiene las etiquetas requeridas para este tipo de declaración desde las reglas
    const typeRule = rules[type] as { requiredTags: readonly string[] } | undefined;
    const requiredTags = typeRule?.requiredTags || [];

    // Verifica qué etiquetas requeridas faltan en el bloque de comentarios
    const missingTags = requiredTags.filter(tag => !commentBlock.includes(tag));

    // Si faltan etiquetas, indica cuáles
    if (missingTags.length > 0) {
        errors.push(`Error: The ${type} declaration is missing the following required tags: ${missingTags.join(', ')}.`);
    }

    // Verifica formato según TSDoc

    // Verifica que la primera línea tenga un resumen (summary)
    const lines_after_opening = commentBlock.split('\n').slice(1);
    const first_content_line = lines_after_opening.find(line => line.trim() !== '');

    if (!first_content_line || first_content_line.trim().startsWith('*') && first_content_line.trim().substring(1).trim().startsWith('@')) {
        errors.push(`Error: TSDoc requires a summary line at the beginning of the documentation block for ${type} declaration.`);
    }

    // Busca etiquetas incorrectas o no estándar en TSDoc
    const nonStandardTags = [
        '@category', '@package', '@author', '@var', '@version',
        // Estas etiquetas no son parte del estándar TSDoc
    ];

    for (const tag of nonStandardTags as string[]) {
        if (commentBlock.includes(tag)) {
            errors.push(`Warning: The tag ${tag} is not part of the standard TSDoc. Consider using appropriate TSDoc tags instead.`);
        }
    }

    // Si no hay errores, la documentación es válida
    return errors;
}

/**
 * Validates a file by checking for proper documentation on changed lines
 *
 * @param filePath - Path to the file
 * @param changed - Set of changed line numbers
 * @returns List of errors found
 * @remarks Processes each changed line to find its declaration and validate docs
 * @throws May return file reading errors as error messages
 * @public
 */
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
 * Executes validation on all files with changes
 *
 * @returns True if validation passes, false if there are errors
 * @remarks Main function that orchestrates the entire validation process
 * @throws May log errors but always returns a boolean
 * @public
 */
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
            console.log('\nPlease ensure all declarations have proper English TSDoc documentation.');
        } else {
            // Si la validación fue exitosa, registra un mensaje de éxito
            logDebug('✅ TSDoc validation completed successfully with no errors.');
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