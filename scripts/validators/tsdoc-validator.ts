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
    console.log(`[${new Date().toISOString()}] ${message}`); //Escribe en la consola el mensaje de error
}

// Imprime un mensaje indicando que el validador TSDoc está en ejecución
logDebug('🔍 Validador TSDoc en ejecución...');

/**
 * Obtiene las líneas modificadas de los archivos en el push actual.
 *
 * @returns Un objeto con los archivos y sus líneas modificadas.
 */
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
function findDeclarationLine( // Función que busca hacia arriba desde una línea dada hasta encontrar una declaración de clase, función o propiedad, ignorando comentarios y líneas vacías.
    lines: string[], // Arreglo de líneas de código fuente.
    startIndex: number  // Índice desde el cual se empieza a buscar hacia arriba.
): { index: number; type: keyof typeof rules } | null { // Devuelve un objeto con el índice de la línea encontrada y su tipo (según 'rules'), o null si no se encuentra nada.

    for (let i = startIndex; i >= 0; i--) { // Recorre las líneas hacia arriba, desde la línea indicada hasta la primera.
        const trimmed = lines[i].trim(); // Elimina espacios en blanco de la línea actual para facilitar la comparación.

        // Ignorar apertura de bloque de comentario /**…
        if (trimmed.startsWith('/**')) {
            continue;
        }
        // Ignorar líneas interiores de comentario (* …)
        if (trimmed.startsWith('*')) {
            continue;
        }
        // Ignorar cierre de bloque */
        if (trimmed === '*/') {
            continue;
        }
        // Ignorar líneas en blanco
        if (trimmed === '') {
            continue;
        }

        // Si es una declaración, la devolvemos
        if (
            trimmed.startsWith('class ') || // Detecta clases.
            trimmed.startsWith('interface ') || // Detecta interfaces.
            trimmed.startsWith('function ') || // Detecta funciones.
            /^[a-zA-Z0-9_]+\s*\(.*\)\s*{?$/.test(trimmed) ||  // Detecta funciones tipo flecha o anónimas.
            trimmed.startsWith('public ') || // Detecta propiedades con acceso público.
            trimmed.startsWith('private ') || // Detecta propiedades con acceso privado.
            trimmed.startsWith('protected ') || // Detecta propiedades con acceso protegido.
            /^[a-zA-Z0-9_]+\s*[:=]/.test(trimmed) // Detecta propiedades simples con tipo o asignación.
        ) {
            return {
                index: i,  // Devuelve el índice de la línea encontrada.
                type: determineDeclarationType(trimmed) // Determina si es clase, función o propiedad según su estructura.
            };
        }

    }

    return null; // Si no se encuentra ninguna declaración válida, se devuelve null.
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
function validateDocumentation(lines: string[], declarationIndex: number, type: keyof typeof rules): string[] { // Válida si existe un bloque de documentación TSDoc antes de una declaración (función, clase, etc.), revisa que esté en inglés y que incluya etiquetas necesarias como @param y @returns si corresponde.

    let i = declarationIndex - 1; // Inicializa 'i' para comenzar a buscar desde la línea anterior a la declaración
    let foundComment = false; // Bandera que indica si se encontró un bloque de comentario válido

    const MAX_BLANK_LINES = 5; // Define el número máximo de líneas en blanco permitidas entre la declaración y el comentario
    let blankLineCount = 0;  // Contador de líneas en blanco encontradas durante la búsqueda hacia atrás

    while (i >= 0) { // Bucle que recorre las líneas hacia atrás desde la declaración
        const trimmedLine = lines[i].trim(); // Elimina espacios en blanco al inicio y final de la línea actual

        if (trimmedLine === '') {  // Verifica si la línea está vacía
            blankLineCount++; // Incrementa el contador de líneas en blanco
            if (blankLineCount > MAX_BLANK_LINES) { // Sí se excede el límite de líneas en blanco
                break; // Termina la búsqueda porque se considera que no hay comentario asociado
            }
        } else if (trimmedLine === '*/') {  // Verifica si la línea actual es el cierre de un bloque de comentario
            foundComment = true; // Marca que se ha encontrado un bloque de comentario
            break; // Finaliza el bucle al encontrar el cierre del comentario
        } else { // Si la línea no es vacía ni cierre de comentario
            break; // Detiene la búsqueda porque se encontró otro tipo de contenido
        }
        i--;// Retrocede una línea en el archivo para continuar la búsqueda
    }

    if (!foundComment) { // Si no se encontró un cierre de comentario
        return [`Error: Falta el bloque TSDoc sobre la declaración de ${type}.`]; // Devuelve un error indicando que falta documentación
    }

    let startCommentIndex = i; // Establece el índice inicial del comentario en la posición del cierre encontrado
    while (startCommentIndex >= 0 && !lines[startCommentIndex].trim().startsWith('/**')) { // Bucle para buscar hacia atrás hasta encontrar la apertura del comentario y Verificar si la línea inicia el bloque de comentario
        startCommentIndex--;  // Retrocede una línea en la búsqueda del inicio del comentario
    }

    if (startCommentIndex < 0) { // Si no se encontró la apertura del bloque de comentario
        return [`Error: Se encontró un cierre de comentario sin apertura para la declaración de ${type}.`]; // Devuelve error por bloque incompleto
    }

    const commentBlock = lines.slice(startCommentIndex, i + 1).join('\n'); // Extrae las líneas del bloque de comentario y las une en un solo string

    const errors: string[] = []; // Inicializa un arreglo para almacenar los errores encontrados

    const originalDeclaration = lines[declarationIndex]; // Guarda la línea original de la declaración para analizarla posteriormente

    // Comprobar si la función o metodo tiene parámetros
    if (type === 'function' || type === 'class') { // Verifica si la declaración es de tipo función o clase
        const hasParameters = originalDeclaration.includes('(') && // Evalúa si la declaración tiene parámetros
            !originalDeclaration.includes('()') && // Asegura que no sea una función vacía
            !originalDeclaration.includes('( )'); // Asegura que no sea una función vacía

        if (hasParameters && !commentBlock.includes('@param')) { // Si tiene parámetros pero no se documentaron
            errors.push(`Error: La declaración tiene parámetros pero falta documentación con etiquetas @param.`); // Agrega error por falta de @param
        }

        if (type === 'function' && // Si es una función
            originalDeclaration.includes('): ') && // Verifica que tenga un tipo de retorno explícito
            !originalDeclaration.includes('): void') &&  // Asegura que no sea 'void'
            !commentBlock.includes('@returns') && // Y que no tenga documentación de retorno
            !commentBlock.includes('@return')) { // (considera variantes de la etiqueta)
            errors.push(`Error: La función parece devolver un valor pero falta la etiqueta @returns.`); // Agrega error por falta de @returns
        }
    }

    const languageErrors = validateEnglishDocumentation(commentBlock); // Ejecuta una validación para detectar si el comentario está en español
    if (languageErrors.length > 0) { // Si se detectaron errores de idioma
        errors.push(...languageErrors); // Agrega los errores de idioma a la lista de errores
    }

    return errors; // Devuelve el arreglo con todos los errores encontrados (si hay)
}

/**
 * Válida un archivo verificando la documentación correcta en los cambios.
 *
 * @param filePath - Ruta del archivo.
 * @param changed - Líneas cambiadas.
 * @returns Lista de errores encontrados.
 */
function validateFile(filePath: string, changed: Set<number>): string[] { // Valida un archivo analizando solo las líneas modificadas; detecta declaraciones en esas líneas y verifica si tienen la documentación correcta en inglés, con etiquetas como @param y @returns si aplica
    try { // Intenta ejecutar la validación y captura errores si ocurren
        if (!existsSync(filePath)) { // Verifica si el archivo existe en el sistema
            logDebug(`Archivo no encontrado: ${filePath}`); // Muestra mensaje en consola si no existe
            return [`Error: Archivo no encontrado - ${filePath}`]; // Devuelve error si el archivo no existe
        }

        const fileContent = readFileSync(filePath, 'utf8'); // Lee el contenido del archivo como texto
        const lines = fileContent.split('\n'); // Divide el contenido en un arreglo de líneas
        const errors: string[] = []; // Inicializa el arreglo donde se almacenarán los errores

        const declarations: Array<{ index: number; type: keyof typeof rules }> = [];  // Guarda las declaraciones encontradas en líneas modificadas

        changed.forEach(lineNumber => {// Recorre cada línea modificada
            const lineIndex = lineNumber - 1; // Ajusta el número de línea al índice del arreglo
            if (lineIndex < 0 || lineIndex >= lines.length) return; // Ignora si el índice es inválido

            logDebug(`Verificando línea cambiada ${lineNumber}: ${lines[lineIndex].trim()}`);  // Muestra la línea que se está evaluando

            const declaration = findDeclarationLine(lines, lineIndex); // Busca si hay una declaración en esa línea o líneas previas
            if (!declaration) { // Si no encuentra una declaración, la ignora
                logDebug(`No se encontró declaración para la línea ${lineNumber}`);// Muestra mensaje si no hay declaración
                return; // Salta a la siguiente línea
            }

            const alreadyIncluded = declarations.some(d => d.index === declaration.index); // Verifica si ya se registró esta declaración
            if (!alreadyIncluded) { // Si no estaba incluida aún
                declarations.push(declaration); // La agrega a la lista de declaraciones
                logDebug(`Declaración encontrada en línea ${declaration.index + 1}: ${lines[declaration.index].trim()}`); // Muestra la declaración encontrada
            }
        });

        declarations.forEach(({ index: declarationIndex, type }) => {// Recorre todas las declaraciones encontradas
            logDebug(`Validando ${type} en línea ${declarationIndex + 1} en ${filePath}`); // Muestra qué tipo de declaración se está validando

            const validationErrors = validateDocumentation(lines, declarationIndex, type); // Ejecuta la validación de la documentación
            if (validationErrors.length > 0) { // Si hay errores de documentación
                const codeLine = lines[declarationIndex].trim(); // Obtiene el contenido de la línea con la declaración
                errors.push(`Error en línea ${declarationIndex + 1}: ${codeLine}`); // Agrega un mensaje de error con el código
                errors.push(...validationErrors.map(e => `  - ${e}`)); // Agrega los errores de validación detallados
            }
        });

        return errors; // Devuelve todos los errores encontrados
    } catch (error) { // Captura cualquier excepción
        logDebug(`Error al validar archivo ${filePath}: ${error}`); // Muestra el error ocurrido durante la validación
        return [`Error al validar archivo ${filePath}: ${error}`]; // Devuelve el error como mensaje
    }
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

            if (file.endsWith('tsdoc-validator.ts') || file === 'tsdoc-rules.ts' || file.includes('node_modules/'))  { // Evita validar el propio validador o archivos de node_modules
                continue;
            }

            const fullPath = path.resolve(file); // Resuelve la ruta absoluta del archivo
            logDebug(`Validando archivo: ${fullPath}`); // Muestra en consola qué archivo se está validando

            const errors = validateFile(fullPath, changedLines[file]); // Ejecuta la validación del archivo con base en sus líneas modificadas

            if (errors.length > 0) { // Sí hay errores en ese archivo
                errorsByFile[file] = errors; // Guarda los errores asociados al archivo
                totalErrors += errors.length; // Suma los errores al total
                validationResult = false; // Marca que hubo errores
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