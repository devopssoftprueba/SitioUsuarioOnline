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
function determineDeclarationType(line: string): keyof typeof rules | null {
    const trimmed = line.trim();

    // Ignorar comentarios y líneas vacías
    if (trimmed === '' ||
        trimmed.startsWith('/*') ||
        trimmed.startsWith('*') ||
        trimmed.startsWith('*/') ||
        trimmed.startsWith('//')) {
        return null;
    }

    // Clases e interfaces
    if (trimmed.startsWith('class ') || trimmed.startsWith('interface ')) {
        return 'class';
    }

    // Funciones y métodos
    if (
        trimmed.startsWith('function ') ||
        trimmed.match(/^(?:async\s+)?[a-zA-Z0-9_]+\s*\(.*\)\s*{?$/) ||
        trimmed.match(/^(?:public|private|protected)\s+(?:async\s+)?[a-zA-Z0-9_]+\s*\(.*\)\s*{?$/) ||
        trimmed.match(/^[a-zA-Z0-9_]+\s*\(.*\)\s*:\s*[a-zA-Z<>[\]]+\s*{/)
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

    return null; // Cambiado de 'function' a null
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

    // Añadir esta línea para usar analyzeContext
    const nestingLevel = analyzeContext(lines, startIndex);

    while (i >= 0) {
        const currentLine = lines[i].trim();

        // Si es una línea de comentario o vacía, continuar
        if (currentLine === '' ||
            currentLine.startsWith('/*') ||
            currentLine.startsWith('*') ||
            currentLine.startsWith('*/') ||
            currentLine.startsWith('//')) {
            i--;
            continue;
        }

        // Obtener el tipo de declaración
        const type = determineDeclarationType(currentLine);
        if (type !== null) {
            // Añadir esta condición para usar nestingLevel
            if (nestingLevel > 0 && type === 'class') {
                i--;
                continue;
            }
            return {
                index: i,
                type: type
            };
        }

        // El resto de la función sigue igual...
        i--;
    }

    return null;
}

/**
 * Extrae el nombre del parámetro limpio de una declaración de parámetro.
 *
 * @param param - Texto del parámetro
 * @returns Nombre del parámetro limpio
 */
function extractParamName(param: string): string {
    // Eliminar modificadores de acceso
    let cleaned = param.replace(/^(readonly|public|private|protected)\s+/, '');

    // Extraer solo el nombre antes de : o =
    const parts = cleaned.split(/[:=]/);
    cleaned = parts[0].trim();

    // Eliminar operador rest si existe
    cleaned = cleaned.replace(/^\.\.\./, '');

    return cleaned;
}

function analyzeFunctionSignature(
    declarationLine: string,
    lines: string[],
    index: number
): { parameters: string[], hasReturn: boolean } {
    // Extraer parámetros
    const paramMatch = declarationLine.match(/\(([^)]*)\)/);
    const parameters: string[] = [];

    if (paramMatch && paramMatch[1]) {
        const paramString = paramMatch[1].trim();
        if (paramString) {
            // Análisis más robusto de parámetros
            let inTemplate = 0;
            let currentParam = '';
            let bracketCount = 0;

            for (let i = 0; i < paramString.length; i++) {
                const char = paramString[i];

                if (char === '<') inTemplate++;
                else if (char === '>') inTemplate--;
                else if (char === '{') bracketCount++;
                else if (char === '}') bracketCount--;
                else if (char === ',' && inTemplate === 0 && bracketCount === 0) {
                    if (currentParam.trim()) {
                        parameters.push(extractParamName(currentParam.trim()));
                    }
                    currentParam = '';
                    continue;
                }

                currentParam += char;
            }

            if (currentParam.trim()) {
                parameters.push(extractParamName(currentParam.trim()));
            }
        }
    }

    // Detectar si la función tiene un valor de retorno
    let hasReturn = false;

    // Buscar en la línea de declaración si hay un tipo de retorno
    if (declarationLine.includes(':') && !declarationLine.includes(': void')) {
        hasReturn = true;
    } else if (declarationLine.includes('=> {') || declarationLine.includes('=>{')) {
        // Arrow function con bloque
        hasReturn = detectReturnInFunction(lines, index);
    } else if (declarationLine.includes('=>') && !declarationLine.includes('=> void')) {
        // Arrow function con retorno implícito
        hasReturn = true;
    } else if (declarationLine.includes('{')) {
        // Función normal con bloque
        hasReturn = detectReturnInFunction(lines, index);
    }

    return { parameters, hasReturn };
}

/**
 * Detecta si una función tiene sentencias return en su cuerpo.
 *
 * @param lines - Líneas del archivo
 * @param startIndex - Índice donde comienza la función
 * @returns true si la función tiene al menos un return que no sea void
 */
function detectReturnInFunction(lines: string[], startIndex: number): boolean {
    let bracketCount = 0;
    let startCounting = false;

    // Buscar la llave de apertura de la función
    for (let i = startIndex; i < lines.length; i++) {
        if (lines[i].includes('{')) {
            startCounting = true;
            bracketCount = 1;

            // Si en la misma línea hay un return, verificar
            if (lines[i].includes('return ') && !lines[i].includes('return;') && !lines[i].includes('return undefined') && !lines[i].includes('return void')) {
                return true;
            }

            continue;
        }

        if (!startCounting) continue;

        // Contar llaves para saber cuándo termina la función
        for (const char of lines[i]) {
            if (char === '{') bracketCount++;
            else if (char === '}') {
                bracketCount--;
                if (bracketCount === 0) return false; // Fin de la función sin return
            }
        }

        // Verificar si hay un return en esta línea
        if (lines[i].includes('return ') && !lines[i].includes('return;') && !lines[i].includes('return undefined') && !lines[i].includes('return void')) {
            return true;
        }
    }

    return false;
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
    const errors: string[] = [];

    // Buscar el comentario TSDoc arriba de la declaración
    let i = declarationIndex - 1;
    let foundComment = false;
    let commentStartIndex = -1;

    // Saltamos espacios en blanco
    while (i >= 0 && lines[i].trim() === '') {
        i--;
    }

    // Verificar si hay un bloque de comentarios TSDoc
    if (i >= 0 && String(lines[i]).trim() === '*/') {
        foundComment = true;
        // Retroceder hasta encontrar el inicio del comentario
        while (i >= 0 && !String(lines[i]).trim().startsWith('/**')) {
            i--;
        }
        commentStartIndex = i;
    }

    if (!foundComment || commentStartIndex < 0) {
        return [`Error: Falta el bloque TSDoc sobre la declaración de ${type} en línea ${declarationIndex + 1}.`];
    }

    // Obtener el bloque de comentarios completo y asegurar que trabajamos con strings
    const commentBlock = lines
        .slice(commentStartIndex, declarationIndex)
        .map(line => String(line))
        .join('\n');
    const commentLines = commentBlock.split('\n').map(line => String(line));

    // Validar que el comentario esté en inglés
    const englishErrors = validateEnglishDocumentation(commentBlock);
    if (englishErrors.length > 0) {
        errors.push(...englishErrors);
    }

    // Obtener todas las etiquetas presentes en el comentario
    const tagRegex = /^\s*\*\s*@(\w+)/;
    const presentTags = new Set<string>();

    for (const line of commentLines) {
        const match = line.match(tagRegex);
        if (match && match[1]) {
            presentTags.add(match[1]);
        }
    }

    // Verificar etiquetas requeridas según las reglas
    const ruleSet = rules[type];
    if (ruleSet && Array.isArray(ruleSet.requiredTags)) {
        for (const tag of ruleSet.requiredTags) {
            // Asegurarnos de que tag es un string
            const tagName = String(tag).replace('@', '');
            if (!presentTags.has(tagName)) {
                errors.push(`Error: Falta la etiqueta requerida @${tagName} en la documentación de la línea ${declarationIndex + 1}.`);
            }
        }
    }

    // Para funciones, verificar parámetros y retorno basado en la firma
    if (type === 'function') {
        const declarationLine = String(lines[declarationIndex]);
        const { parameters, hasReturn } = analyzeFunctionSignature(declarationLine, lines, declarationIndex);

        // Verificar documentación de parámetros
        if (parameters.length > 0) {
            const paramDocs = commentLines.filter(line =>
                String(line).trim().match(/^\s*\*\s*@param\b/)
            );

            const documentedParams = new Set<string>();
            for (const paramDoc of paramDocs) {
                // Extraer nombre de parámetro documentado (diferentes formatos posibles)
                const paramMatch = String(paramDoc).match(/@param\s+(?:\{[^}]*\s+)?(\w+)/);
                if (paramMatch && paramMatch[1]) {
                    documentedParams.add(paramMatch[1]);
                }
            }

            // Verificar que todos los parámetros están documentados
            for (const param of parameters) {
                if (param && !documentedParams.has(param)) {
                    errors.push(`Error: Parámetro '${param}' no está documentado con @param en la línea ${declarationIndex + 1}.`);
                }
            }
        }

        // Verificar documentación de retorno solo si la función tiene retorno
        if (hasReturn) {
            const hasReturnDoc = commentLines.some(line =>
                String(line).trim().match(/^\s*\*\s*@returns\b/) ||
                String(line).trim().match(/^\s*\*\s*@return\b/)
            );

            if (!hasReturnDoc) {
                errors.push(`Error: Falta documentación @returns para el valor de retorno en la línea ${declarationIndex + 1}.`);
            }
        }
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

    // Ordenar las líneas cambiadas
    const changedLinesArray = Array.from(changed).sort((a, b) => a - b);

    // Crear un mapa para rastrear las declaraciones ya procesadas
    const processedDeclarations = new Map<number, boolean>();

    for (const lineNumber of changedLinesArray) {
        const lineIndex = lineNumber - 1;
        if (lineIndex < 0 || lineIndex >= lines.length) continue;

        const line = lines[lineIndex].trim();
        logDebug(`Verificando línea cambiada ${lineNumber}: ${line}`);

        // Ignorar líneas de comentarios y vacías
        if (line.startsWith('/*') || line.startsWith('*') || line === '' || line.startsWith('//')) {
            continue;
        }

        const declaration = findDeclarationLine(lines, lineIndex);
        if (declaration) {
            // Si la declaración no ha sido procesada aún
            if (!processedDeclarations.has(declaration.index)) {
                logDebug(`Validando declaración en línea ${declaration.index + 1}: ${lines[declaration.index].trim()}`);

                const validationErrors = validateDocumentation(
                    lines,
                    declaration.index,
                    declaration.type
                );

                if (validationErrors.length > 0) {
                    errors.push(...validationErrors.map(
                        err => `${err} (línea ${declaration.index + 1})`
                    ));
                }

                // Marcar esta declaración como procesada
                processedDeclarations.set(declaration.index, true);
            } else {
                logDebug(`Declaración en línea ${declaration.index + 1} ya validada, saltando.`);
            }
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