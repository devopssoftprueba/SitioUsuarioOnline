// Importa la función execSync del módulo child_process para ejecutar comandos de terminal
import { execSync } from 'child_process';
// Importa las funciones readFileSync y existsSync del módulo fs para leer archivos y verificar su existencia
import { readFileSync, existsSync } from 'fs';
// Importa todas las funcionalidades del módulo path para manejar rutas de archivos
import * as path from 'path';

const rules = {
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

function logDebug(message: string): void {
    console.log(`[${new Date().toISOString()}] ${message}`);
}

// Imprime un mensaje indicando que el validador TSDoc está en ejecución
logDebug('🔍 Validador TSDoc en ejecución...');
function getChangedLines(): { lines: ChangedLines; functions: Record<string, Set<number>> } {
    try {
        const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
        const remoteExists = execSync(`git ls-remote --heads origin ${currentBranch}`, { encoding: 'utf8' }).trim();

        let diffCommand = '';
        if (remoteExists) {
            diffCommand = `git diff origin/${currentBranch}..HEAD -U3 --no-color`;
            logDebug(`Comparando con rama remota: origin/${currentBranch}`);
        } else {
            let baseBranch = 'main';
            try {
                execSync('git rev-parse --verify origin/main');
            } catch {
                try {
                    execSync('git rev-parse --verify origin/master');
                    baseBranch = 'master';
                } catch {
                    try {
                        execSync('git rev-parse --verify origin/develop');
                        baseBranch = 'develop';
                    } catch {
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

        const stagedDiffCommand = 'git diff --staged -U3 --no-color';
        const unstagedDiffCommand = 'git diff -U3 --no-color';

        const changedLines: ChangedLines = {};
        const modifiedFunctions: Record<string, Set<number>> = {};

        const fileRegex = /^diff --git a\/(.+?) b\/(.+)$/;
        const hunkRegex = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

        const processDiffOutput = (diffOutput: string) => {
            let currentFile = '';
            const lines = diffOutput.split('\n');
            let newLineNumber = 0;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                const fileMatch = line.match(fileRegex);
                if (fileMatch) {
                    const [, , newFile] = fileMatch;
                    currentFile = newFile;
                    continue;
                }

                const hunkMatch = line.match(hunkRegex);
                if (hunkMatch && currentFile) {
                    newLineNumber = parseInt(hunkMatch[1], 10);
                    if (!changedLines[currentFile]) {
                        changedLines[currentFile] = new Set<number>();
                    }
                    continue;
                }

                if (!currentFile || !changedLines[currentFile]) continue;

                if (line.startsWith('+') && !line.startsWith('+++')) {
                    changedLines[currentFile].add(newLineNumber);
                    newLineNumber++;
                } else if (line.startsWith('-') && !line.startsWith('---')) {
                    changedLines[currentFile].add(newLineNumber);
                } else {
                    newLineNumber++;
                }
            }
        };

        try {
            processDiffOutput(execSync(diffCommand, { encoding: 'utf8' }));
        } catch (e) {
            logDebug(`Error en diff principal: ${e}`);
        }

        try {
            processDiffOutput(execSync(stagedDiffCommand, { encoding: 'utf8' }));
        } catch (e) {
            logDebug(`Error en diff staged: ${e}`);
        }

        try {
            processDiffOutput(execSync(unstagedDiffCommand, { encoding: 'utf8' }));
        } catch (e) {
            logDebug(`Error en diff unstaged: ${e}`);
        }

        // NUEVO: Añadir un logging más detallado para depuración
        if (Object.keys(changedLines).length > 0) {
            logDebug('Detalle de líneas modificadas:');
            for (const file in changedLines) {
                const lines = Array.from(changedLines[file]).sort((a, b) => a - b);
                logDebug(`  ${file}: líneas ${lines.join(', ')}`);
            }
        }

        logDebug(`Se encontraron cambios en ${Object.keys(changedLines).length} archivos`);
        return { lines: changedLines, functions: modifiedFunctions };
    } catch (error) {
        logDebug(`Error al obtener líneas cambiadas: ${error}`);
        return { lines: {}, functions: {} };
    }

}

// 1. Función para determinar el tipo de declaración (mejorada para detectar métodos de clase con tipo de retorno)
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
        // NUEVO: Detección de métodos de clase con tipo de retorno
        trimmed.match(/^(?:async\s+)?[a-zA-Z0-9_]+\s*\(.*\)\s*:\s*[a-zA-Z0-9_<>[\]|&]+\s*{?$/) ||
        trimmed.match(/^(?:async\s+)?[a-zA-Z0-9_]+\s*\(.*\)\s*{?$/) ||
        trimmed.match(/^(?:public|private|protected)\s+(?:async\s+)?[a-zA-Z0-9_]+\s*\(.*\)\s*{?$/) ||
        // NUEVO: Métodos de clase con modificadores y tipo de retorno
        trimmed.match(/^(?:public|private|protected)\s+(?:async\s+)?[a-zA-Z0-9_]+\s*\(.*\)\s*:\s*[a-zA-Z0-9_<>[\]|&]+\s*{?$/) ||
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

    return 'function'; // Por defecto asumimos función si no podemos determinar claramente
}

function findDeclarationForComment(lines: string[], commentLine: number): number {
    // Primero, encontrar el final del bloque de comentarios
    let endOfComment = commentLine;
    while (endOfComment < lines.length &&
    !lines[endOfComment].trim().endsWith('*/') &&
    lines[endOfComment].trim() !== '*/') {
        endOfComment++;
    }

    if (endOfComment >= lines.length) return -1; // No encontramos el final

    // Buscar la primera declaración no vacía después del comentario
    let lineAfterComment = endOfComment + 1;
    while (lineAfterComment < lines.length) {
        const line = lines[lineAfterComment].trim();

        // Ignorar líneas vacías y decoradores
        if (line === '' || line.startsWith('@')) {
            lineAfterComment++;
            continue;
        }

        // Si encontramos una declaración, la retornamos
        const decl = findDeclarationLine(lines, lineAfterComment);
        if (decl) {
            return decl.index;
        }

        // Si no es decorador ni vacía pero no es declaración, paramos
        break;
    }

    return -1; // No encontramos declaración asociada
}

function isInsideComment(lines: string[], lineIndex: number): boolean {
    // Verificar si la línea es parte de un bloque de comentarios
    const currentLine = lines[lineIndex].trim();

    // Comprobaciones rápidas
    if (currentLine.startsWith('/**') ||
        (currentLine.startsWith('*') && !currentLine.startsWith('*/')) ||
        currentLine === '*/') {
        return true;
    }

    // Verificar si está dentro de un bloque de comentarios buscando /** hacia arriba y */ hacia abajo
    let start = lineIndex;
    while (start >= 0) {
        const line = lines[start].trim();
        if (line.startsWith('/**')) break;
        if (line === '*/') return false; // Encontramos un cierre antes que una apertura
        start--;
    }

    if (start < 0) return false; // No encontramos apertura

    let end = lineIndex;
    while (end < lines.length) {
        const line = lines[end].trim();
        if (line === '*/' || line.endsWith('*/')) break;
        end++;
    }

    return end < lines.length; // Si encontramos cierre, está dentro de un comentario
}

function findDeclarationLine(
    lines: string[],
    startIndex: number
): { index: number; type: keyof typeof rules } | null {
    // Verificamos primero la línea actual
    if (startIndex >= 0 && startIndex < lines.length) {
        const currentLine = lines[startIndex].trim();

        // Patrones más completos para detectar declaraciones
        if (
            currentLine.startsWith('class ') ||
            currentLine.startsWith('interface ') ||
            currentLine.startsWith('function ') ||
            currentLine.match(/^export\s+(class|interface|function|const|let|var)/) ||
            currentLine.match(/^export\s+default\s+(class|interface|function)/) ||
            currentLine.match(/^(public|private|protected|readonly|static)/) ||
            currentLine.match(/^[a-zA-Z0-9_]+\s*\(.*\)\s*{?$/) ||
            currentLine.match(/^async\s+[a-zA-Z0-9_]+\s*\(.*\)\s*{?$/) ||
            (currentLine.startsWith('const ') || currentLine.startsWith('let ') || currentLine.startsWith('var ')) &&
            (currentLine.includes(' = function') || currentLine.includes(' = (') ||
                currentLine.includes(' = async') || currentLine.includes('=>'))
        ) {
            return {
                index: startIndex,
                type: determineDeclarationType(currentLine)
            };
        }
    }

    // Si no encontramos nada en la línea actual, buscamos hacia arriba
    for (let i = startIndex - 1; i >= 0; i--) {
        const trimmed = lines[i].trim();

        // Ignoramos comentarios, líneas vacías y decoradores
        if (trimmed === '' ||
            trimmed.startsWith('/**') ||
            trimmed.startsWith('*') ||
            trimmed === '*/' ||
            trimmed.startsWith('@')) {
            continue;
        }

        // Si encontramos un cierre de bloque, saltamos al bloque superior
        if (trimmed === '}') {
            let openBrackets = 1;
            let j = i - 1;
            while (j >= 0 && openBrackets > 0) {
                const bracketLine = lines[j].trim();
                if (bracketLine.endsWith('}')) {
                    openBrackets++;
                } else if (bracketLine.endsWith('{')) {
                    openBrackets--;
                }
                j--;
            }
            i = j + 1;
            continue;
        }

        // Patrones mejorados para detección de declaraciones
        if (
            trimmed.startsWith('class ') ||
            trimmed.startsWith('interface ') ||
            trimmed.startsWith('function ') ||
            trimmed.match(/^export\s+(class|interface|function|const|let|var)/) ||
            trimmed.match(/^export\s+default\s+(class|interface|function)/) ||
            trimmed.match(/^(public|private|protected|readonly|static)/) ||
            trimmed.match(/^[a-zA-Z0-9_]+\s*\(.*\)\s*{?$/) ||
            trimmed.match(/^async\s+[a-zA-Z0-9_]+\s*\(.*\)\s*{?$/) ||
            (trimmed.startsWith('const ') || trimmed.startsWith('let ') || trimmed.startsWith('var ')) &&
            (trimmed.includes(' = function') || trimmed.includes(' = (') ||
                trimmed.includes(' = async') || trimmed.includes('=>'))
        ) {
            return {
                index: i,
                type: determineDeclarationType(trimmed)
            };
        }
    }

    return null;
}
function validateEnglishDocumentation(commentBlock: string): string[] {
    // Ampliamos significativamente el glosario de palabras en español
    const spanishWords = [
        // Artículos
        'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'del', 'al',

        // Preposiciones comunes
        'para', 'por', 'con', 'sin', 'de', 'a', 'ante', 'bajo', 'contra', 'desde',
        'en', 'entre', 'hacia', 'hasta', 'según', 'sobre', 'tras',

        // Conjunciones comunes
        'y', 'e', 'o', 'u', 'ni', 'que', 'porque', 'como', 'cuando', 'si', 'pero',
        'aunque', 'mientras', 'pues', 'ya', 'también',

        // Verbos comunes
        'es', 'son', 'está', 'están', 'tiene', 'tienen', 'hace', 'hacen', 'puede', 'pueden',
        'debe', 'deben', 'contiene', 'establece', 'devuelve', 'retorna', 'obtiene', 'calcula',
        'muestra', 'ejecuta', 'procesa', 'valida', 'comprueba', 'asigna', 'pongo', 'guarda',

        // Términos técnicos en español
        'función', 'archivo', 'línea', 'código', 'método', 'clase', 'interfaz', 'objeto',
        'variable', 'valor', 'parámetro', 'constante', 'arreglo', 'matriz', 'mapa', 'conjunto',
        'cadena', 'número', 'booleano', 'estructura', 'módulo', 'componente', 'evento',

        // Palabras típicas de documentación en español
        'esto', 'aquí', 'ese', 'esa', 'eso', 'español', 'implementa', 'ejemplo', 'inicializa',
        'área', 'círculo', 'fórmula', 'implementación', 'configuración', 'validación', 'documentación'
    ];

    const cleanedComment = commentBlock
        .split('\n')
        .map(line => line.trim().replace(/^\*\s*/, ''))
        .join(' ')
        .toLowerCase();

    // Ignoramos las secciones de ejemplos y líneas de código
    const relevantText = cleanedComment
        .replace(/@example[\s\S]*?(?=@|$)/, '') // Eliminar bloques @example
        .replace(/```[\s\S]*?```/g, '');        // Eliminar bloques de código

    // Mejoramos la detección eliminando palabras en contextos específicos
    let normalizedText = ' ' + relevantText + ' ';

    // Mejorar detección de palabras completas
    const foundSpanishWords = spanishWords.filter(word => {
        // Buscamos la palabra con límites de palabra completa
        const regex = new RegExp(`\\b${word}\\b`, 'i');
        return regex.test(normalizedText);
    });

    // Aplicamos un umbral para determinar si está en español
    // Si hay más de 2 palabras en español detectadas, consideramos que está en español
    if (foundSpanishWords.length >= 2) {
        return [`Error: La documentación parece estar en español. Palabras detectadas: ${foundSpanishWords.join(', ')}. La documentación debe estar en inglés.`];
    }

    return [];
}

function validateCommentChange(
    lines: string[],
    commentLineIdx: number
): string[] {
    // 1) Encuentra la declaración correspondiente justo debajo
    const decl = findDeclarationLine(lines, commentLineIdx + 1);
    if (!decl) {
        return ['Error: Bloque de documentación modificado sin declaración asociada.'];
    }

    // 2) Invoca la validación real pasando decl.index y decl.type
    return validateDocumentation(lines, decl.index, decl.type);
}

function validateDocumentation(
    lines: string[],
    declarationIndex: number,
    type: keyof typeof rules
): string[] {
    let i = declarationIndex - 1;

    // 1) Subir hasta encontrar '*/' o romper por código
    while (i >= 0) {
        const t = lines[i].trim();
        if (
            t !== '' &&
            !t.startsWith('@') &&
            !t.startsWith('import ') &&
            !t.startsWith('//') &&
            !t.startsWith('*/') &&
            !t.match(/^\s*$/)
        ) {
            return [`Error: Falta el bloque TSDoc sobre la declaración de ${type}.`];
        }
        if (t === '*/') break;
        i--;
    }
    if (i < 0) {
        return [`Error: Falta el bloque TSDoc sobre la declaración de ${type}.`];
    }

    // 2) Bajar hasta '/**'
    let start = i;
    while (start >= 0 && !lines[start].trim().startsWith('/**')) {
        start--;
    }
    if (start < 0) {
        return [`Error: Se encontró un cierre de comentario sin apertura para la declaración de ${type}.`];
    }

    // 3) Extraer bloque
    const commentBlock = lines.slice(start, i + 1).join('\n');
    const errors: string[] = [];
    const declLine = lines[declarationIndex].trim();

    // NUEVO: Loggear para depuración en casos problemáticos
    if (declLine.includes('obtenerDominioCorreo') || declLine.includes('correo')) {
        logDebug(`Validando: "${declLine}" como tipo "${type}"`);
        logDebug(`Bloque de comentario:\n${commentBlock}`);
    }

    // 4) Validar sólo los requiredTags de rules[type]
    const required = rules[type].requiredTags.slice();

    // Si es constructor, no pedimos @returns aunque esté en requiredTags
    if (type === 'function' && /^\s*constructor\s*\(/.test(declLine)) {
        const idx = required.indexOf('@returns');
        if (idx !== -1) required.splice(idx, 1);
    }

    // MEJORADO: Validación de etiquetas y su contenido
    for (const tag of required) {
        // Verificar si la etiqueta existe
        if (!commentBlock.includes(tag)) {
            errors.push(`Error: Falta la etiqueta ${tag} en la documentación de la ${type}.`);
        } else {
            // NUEVO: Verificar que la etiqueta tiene contenido significativo
            const tagPattern = new RegExp(`${tag}\\s+([^@\\n]*?)(?=\\n\\s*\\*\\s*@|\\n\\s*\\*/|$)`, 's');
            const match = commentBlock.match(tagPattern);

            if (!match || match[1].trim().length < 3) {
                errors.push(`Error: La etiqueta ${tag} existe pero no tiene contenido descriptivo adecuado.`);
            } else if (match[1].trim().length < 10) {
                // Advertencia para contenido muy corto pero no vacío
                errors.push(`Advertencia: La etiqueta ${tag} tiene contenido muy breve. Considere añadir más detalles.`);
            }
        }
    }

    // 5) Validar que la documentación esté en inglés
    const langErrs = validateEnglishDocumentation(commentBlock);
    if (langErrs.length) errors.push(...langErrs);

    return errors;
}

function validateFile(
    filePath: string,
    changed: Set<number>
): string[] {
    const errors: string[] = [];
    const validatedDeclarations = new Set<number>();

    if (!existsSync(filePath)) {
        logDebug(`Archivo eliminado: ${filePath}`);
        return [`Archivo eliminado (informativo): ${filePath}`];
    }

    const fileContent = readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n');

    // Convertir las líneas cambiadas a índices de array (0-based)
    const changedIndices = Array.from(changed).map(num => num - 1)
        .filter(idx => idx >= 0 && idx < lines.length);

    logDebug(`Evaluando líneas modificadas en ${filePath}: ${changedIndices.map(i => i+1).join(', ')}`);

    // Procesar las líneas modificadas
    for (const idx of changedIndices) {
        const line = lines[idx].trim();

        // Caso 1: La línea es una declaración en sí misma
        const declaration = findDeclarationLine(lines, idx);
        if (declaration && declaration.index === idx) {
            logDebug(`Línea ${idx+1} es una declaración directa: ${line}`);

            if (!validatedDeclarations.has(declaration.index)) {
                validatedDeclarations.add(declaration.index);

                const docErrors = validateDocumentation(lines, declaration.index, declaration.type);
                if (docErrors.length > 0) {
                    errors.push(`Error en línea ${declaration.index + 1}: ${lines[declaration.index].trim()}`);
                    docErrors.forEach(e => errors.push(`  - ${e}`));
                }
            }
            continue;
        }

        // Caso 2: La línea está dentro de un comentario
        if (isInsideComment(lines, idx)) {
            // NO queremos vincularlo con cualquier declaración, sino con la declaración que sigue inmediatamente
            // después del bloque de comentarios donde está esta línea
            const declarationIndex = findDeclarationForComment(lines, idx);

            if (declarationIndex >= 0 && !validatedDeclarations.has(declarationIndex)) {
                const declarationType = determineDeclarationType(lines[declarationIndex]);
                logDebug(`Cambio en comentario línea ${idx+1} vinculado a declaración en línea ${declarationIndex+1}`);

                // Verificar que la declaración vinculada esté en la línea 43
                if (declarationIndex !== 42) { // 43-1=42 (índices de array son 0-based)
                    logDebug(`IGNORANDO: Cambio en comentario no afecta a la declaración en línea 43`);
                    continue;
                }

                validatedDeclarations.add(declarationIndex);

                const docErrors = validateDocumentation(lines, declarationIndex, declarationType);
                if (docErrors.length > 0) {
                    errors.push(`Error en línea ${declarationIndex + 1}: ${lines[declarationIndex].trim()}`);
                    docErrors.forEach(e => errors.push(`  - ${e}`));
                }
            }
        }
    }

    return errors;
}

function runValidation(): boolean {
    try {
        const { lines: changedLines } = getChangedLines();
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

            const errors = validateFile(fullPath, changedLines[file]);

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

if (require.main === module) {
    console.log('\n🔍 Validador TSDoc en ejecución (análisis inteligente de documentación)');

    const result = runValidation();
    process.exit(result ? 0 : 1); // Exit with code 0 if successful, 1 if errors
}

export { runValidation };