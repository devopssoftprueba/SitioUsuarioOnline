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
 * Registra mensajes de depuración con marca de tiempo
 *
 * @param message - El mensaje a mostrar en el log
 */

/**
 * Obtiene las líneas modificadas de los archivos en el push actual.
 *
 * @returns Un objeto con los archivos y sus líneas modificadas.
 */

/**
 * Determina el tipo de declaración basado en la línea de código.
 *
 * @param line - Línea de código a analizar
 * @returns El tipo de declaración identificado
 */
function determineDeclarationType(line: string): keyof typeof rules {  // Función que determina si una línea representa una clase, función o propiedad, devolviendo la clave correspondiente según la definición de reglas.
    const trimmed = line.trim(); // Elimina espacios en blanco al inicio y al final de la línea para asegurar una comparación limpia.

    if (trimmed.startsWith('class ') || trimmed.startsWith('interface ')) { // Si la línea comienza con "class" o "interface", se considera una declaración de clase o interfaz.
        return 'class'; // Devuelve 'class' como tipo de declaración.
    } else if (
        trimmed.startsWith('function ') || // Si comienza con "function", es una función.
        trimmed.match(/^(?:async\s+)?[a-zA-Z0-9_]+\s*\(.*\)\s*{?$/) ||  // O si es una función anónima, flecha o declarada con async (con o sin modificadores).
        trimmed.match(/^(?:public|private|protected)\s+(?:async\s+)?[a-zA-Z0-9_]+\s*\(.*\)\s*{?$/) // O si tiene un modificador de acceso (público, privado, protegido) seguido de async y luego el nombre.
    ) {
        return 'function';  // Devuelve 'function' como tipo de declaración.
    } else if (
        trimmed.match(/^(?:public|private|protected)?\s*[a-zA-Z0-9_]+\s*[:=]/) || // Si parece una propiedad con modificador de acceso, seguida de ":" o "=".
        trimmed.match(/^(?:readonly|static)\s+[a-zA-Z0-9_]+/) // O si la propiedad es readonly o static.
    ) {
        return 'property';  // Devuelve 'property' como tipo de declaración.
    }

    return 'function'; // Si no se reconoce explícitamente, por defecto se asume que es una función.
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

        // Ignorar comentarios y líneas vacías
        if (trimmed.startsWith('/**') || trimmed.startsWith('*') || trimmed === '*/' || trimmed === '') {
            continue;
        }

        // Detectar declaraciones
        if (
            trimmed.startsWith('class ') ||
            trimmed.startsWith('interface ') ||
            trimmed.startsWith('function ') ||
            /^[a-zA-Z0-9_]+\s*\(.*\)\s*{?$/.test(trimmed) || // Funciones
            trimmed.startsWith('public ') ||
            trimmed.startsWith('private ') ||
            trimmed.startsWith('protected ') ||
            /^[a-zA-Z0-9_]+\s*[:=]/.test(trimmed) // Propiedades
        ) {
            return {
                index: i,
                type: determineDeclarationType(trimmed),
            };
        }
    }

    // Si no se encuentra una declaración válida
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
    let i = declarationIndex - 1;
    let foundComment = false;

    while (i >= 0) {
        const trimmedLine = lines[i].trim();
        if (trimmedLine === '') continue;
        if (trimmedLine === '*/') {
            foundComment = true;
            break;
        }
        i--;
    }

    if (!foundComment) {
        return [`Error: Falta el bloque TSDoc sobre la declaración de ${type}.`];
    }

    const startCommentIndex = i;
    while (i >= 0 && !lines[i].trim().startsWith('/**')) {
        i--;
    }

    if (i < 0) {
        return [`Error: Se encontró un cierre de comentario sin apertura para la declaración de ${type}.`];
    }

    const commentBlock = lines.slice(i, startCommentIndex + 1).join('\n');
    logDebug(`Bloque de comentarios encontrado:\n${commentBlock}`);

    const errors: string[] = validateEnglishDocumentation(commentBlock);
    if (errors.length > 0) {
        logDebug(`Errores detectados en el bloque de comentarios: ${errors.join(', ')}`);
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
    const errors: string[] = [];

    if (!existsSync(filePath)) {
        logDebug(`Archivo eliminado: ${filePath}`);
        return [`Archivo eliminado (informativo): ${filePath}`];
    }

    const fileContent = readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n');

    changed.forEach(lineNumber => {
        const lineIndex = lineNumber - 1; // Ajuste de índice
        if (lineIndex < 0 || lineIndex >= lines.length) return;

        logDebug(`Verificando línea cambiada ${lineNumber}: ${lines[lineIndex].trim()}`);

        const declaration = findDeclarationLine(lines, lineIndex);
        if (declaration) {
            logDebug(`Validando declaración en línea ${declaration.index + 1}: ${lines[declaration.index].trim()}`);

            const validationErrors = validateDocumentation(
                lines,
                declaration.index,
                declaration.type
            );
            if (validationErrors.length > 0) {
                errors.push(...validationErrors);
            }
        } else {
            logDebug(`No se encontró declaración para la línea ${lineNumber}`);
        }
    });

    return errors;
}
/**
 * Ejecuta la validación en todos los archivos con cambios.
 *
 * @returns True si la validación pasa, false si hay errores.
 */
function runValidation(): boolean { // Ejecuta la validación de TSDoc para archivos modificados y devuelve true si no hay errores
    try { // Intenta ejecutar la validación completa
        const changedLines = getChangedLines(); // Obtiene las líneas modificadas agrupadas por archivo
        let validationResult = true; // Bandera para saber si pasó correctamente
        const errorsByFile: Record<string, string[]> = {}; // Objeto para almacenar errores por archivo
        let totalErrors = 0; // Contador de errores totales

        for (const file in changedLines) { // Recorre cada archivo con líneas modificadas
            if (
                !file.endsWith('.ts') && // Verifica que sea archivo .ts
                !file.endsWith('.tsx') && // o .tsx
                !file.endsWith('.js') && // o .js
                !file.endsWith('.jsx') // o .jsx
            ) {
                logDebug(`Omitiendo archivo no JavaScript/TypeScript: ${file}`); // Ignora archivos que no son JS/TS
                continue; // Salta al siguiente archivo
            }

            if (file.endsWith('tsdoc-validator.ts') || file.includes('node_modules/'))  { // Evita validar el propio validador o archivos de node_modules
                continue;
            }

            const fullPath = path.resolve(file); // Resuelve la ruta absoluta del archivo
            logDebug(`Validando archivo: ${fullPath}`); // Muestra en consola qué archivo se está validando

            const errors = validateFile(fullPath, changedLines[file]); // Ejecuta la validación del archivo con base en sus líneas modificadas

            if (errors.length > 0) {
                // Filtra errores reales, excluyendo mensajes informativos
                const realErrors = errors.filter(err => !err.includes('Archivo eliminado (informativo)'));

                if (realErrors.length > 0) {
                    errorsByFile[file] = realErrors; // Solo guarda errores reales
                    totalErrors += realErrors.length;
                    validationResult = false;
                } else {
                    // Si solo hubo mensajes informativos, también los mostramos
                    errorsByFile[file] = errors;
                }
            }

        }

        if (!validationResult) {  // Si hubo errores de documentación
            console.log('\n⚠️  Se encontraron errores de validación TSDoc:');
            console.log('\n╔══════════════════════════════════════════════════════════════════════════════');

            for (const file in errorsByFile) { // Recorre los archivos con errores
                console.log(`║ 📄 Archivo: ${file}`); // Muestra el nombre del archivo
                console.log('║ ' + '─'.repeat(80)); // Línea divisoria

                errorsByFile[file].forEach(error => { // Recorre cada error del archivo
                    console.log(`║ ${error}`); // Muestra el error
                });

                console.log('╟' + '──'.repeat(40));  // Línea separadora entre archivos
            }

            console.log(`╚══════════════════════════════════════════════════════════════════════════════`);
            console.log(`\n📊 Total de errores: ${totalErrors}`); // Muestra total de errores encontrados
            console.log('\n⚠️  Por favor, asegúrate de que todas las nuevas declaraciones estén correctamente documentadas en inglés.'); // Mensaje final al usuario
        } else {
            console.log('\n✅ Validación TSDoc completada sin errores. ¡Buen trabajo!'); // Mensaje si no hubo errores
        }

        return validationResult; // Devuelve true si fue exitoso, false si hubo errores
    } catch (error) { // Si ocurre un error en el proceso
        logDebug(`Error de validación: ${error}`); // Muestra el error en el log
        console.error(`\n⚠️  Error en la validación TSDoc: ${error}`); // Muestra el error al usuario
        return false; // Devuelve false por fallo en la ejecución
    }
}

if (require.main === module) { // Verifica si este archivo se está ejecutando directamente
    console.log('\n🔍 Validador TSDoc en ejecución (análisis inteligente de documentación)');

    const result = runValidation(); // Ejecuta la validación
    process.exit(result ? 0 : 1); // Finaliza el proceso con código 0 si éxito, 1 si error
}

export { runValidation };// Exporta la función para ser usada desde otros archivos