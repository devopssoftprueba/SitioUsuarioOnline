// Importa la función execSync del módulo child_process para ejecutar comandos de terminal
import { execSync } from 'child_process';
// Importa las funciones readFileSync y existsSync del módulo fs para leer archivos y verificar su existencia
import { readFileSync, existsSync } from 'fs';
// Importa todas las funcionalidades del módulo path para manejar rutas de archivos
import * as path from 'path';

// Definición de reglas para documentaciones TSDoc
const rules = {
    class: {
        requiredTags: ['@description'],
        optionalTags: ['@example', '@remarks', '@deprecated']
    },
    function: {
        requiredTags: ['@param', '@returns'],
        optionalTags: ['@example', '@throws', '@remarks', '@deprecated']
    },
    property: {
        requiredTags: ['@description'],
        optionalTags: ['@defaultValue', '@remarks', '@deprecated']
    }
};

// Declaración de los tipos utilizados
type ChangedLines = Record<string, Set<number>>;

/**
 * Función de logging legible y amigable.
 */
function logDebug(message: string): void {
    console.log(`\n[${new Date().toLocaleTimeString()}] ${message}`);
}

/**
 * Función de uso para imprimir mensajes claros y legibles para errores específicos.
 */
function logValidationResult(errorsByFile: Record<string, string[]>, totalErrors: number): void {
    if (totalErrors > 0) {
        console.log('\n❌ **Errores de validación TSDoc encontrados:**');
        console.log('------------------------------------------------------------------------------');

        for (const file in errorsByFile) {
            console.log(`📄 Archivo: ${file}`);
            console.log('───────────────────────────────────────────────────────────────────────────────');

            errorsByFile[file].forEach((error, index) => {
                console.log(`${index + 1}. ${error}`);
            });

            console.log('------------------------------------------------------------------------------');
        }

        console.log(`\n🔴 Total de errores: ${totalErrors}`);
        console.log('❗ Por favor, corrige los errores de documentación antes de continuar.');
    } else {
        console.log('\n✅ **Validación TSDoc completada sin errores. ¡Buen trabajo!**');
    }
}

/**
 * Obtiene las líneas modificadas en los archivos utilizando `git diff`.
 */
function getChangedLines(): { lines: ChangedLines; functions: Record<string, Set<number>> } {
    try {
        const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
        const remoteExists = Boolean(execSync(`git ls-remote --heads origin ${currentBranch}`, { encoding: 'utf8' }).trim());

        // Comando principal de git diff
        let diffCommand = remoteExists
            ? `git diff origin/${currentBranch}..HEAD -U3 --no-color`
            : 'git diff --staged -U3 --no-color';

        if (!remoteExists) {
            logDebug('No se encontró rama remota. Usando cambios preparados (staged).');
        }

        const stagedDiffCommand = 'git diff --staged -U3 --no-color';
        const unstagedDiffCommand = 'git diff -U3 --no-color';

        const changedLines: ChangedLines = {};
        const modifiedFunctions: Record<string, Set<number>> = {};

        const fileRegex = /^diff --git a\/(.+?) b\/(.+)$/;
        const hunkRegex = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

        // Función para procesar la salida de los comandos git diff
        const processDiffOutput = (diffOutput: string) => {
            let currentFile = '';
            const lines = diffOutput.split('\n');
            let newLineNumber = 0;

            for (let line of lines) {
                const fileMatch = line.match(fileRegex);
                if (fileMatch) {
                    [, , currentFile] = fileMatch;
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

        // Ejecutar y procesar los diferentes diffs
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

        if (Object.keys(changedLines).length > 0) {
            logDebug('Líneas modificadas detectadas:');
            for (const file in changedLines) {
                logDebug(`  ${file}: ${[...changedLines[file]].join(', ')}`);
            }
        }

        return { lines: changedLines, functions: modifiedFunctions };
    } catch (error) {
        logDebug(`Error al obtener líneas modificadas: ${error}`);
        return { lines: {}, functions: {} };
    }
}

/**
 * Determina el tipo de declaración (clase, función, etc.) en una línea de código.
 */
function determineDeclarationType(line: string): keyof typeof rules {
    const trimmed = line.trim();

    if (trimmed.startsWith('class ') || trimmed.startsWith('interface ') || trimmed.match(/^export\s+(class|interface)/)) {
        return 'class';
    }

    if (
        trimmed.startsWith('function ') ||
        trimmed.match(/^(async\s+)?\w+\s*\(.*\)\s*:/) ||
        trimmed.includes(' function') ||
        trimmed.includes('=>')
    ) {
        return 'function';
    }

    if (trimmed.match(/^[\w]+\s*:\s*[\w]+/)) {
        return 'property';
    }

    return 'function';
}

/**
 * Valida la documentación TSDoc asociada con una declaración en el archivo.
 */
function validateDocumentation(lines: string[], declarationIndex: number, type: keyof typeof rules): string[] {
    const errors: string[] = [];
    let i = declarationIndex;

    while (i >= 0) {
        const line = lines[i]?.trim() || '';

        if (line.startsWith('/**')) break;
        if (line !== '' && !line.startsWith('//')) {
            errors.push(`Error: Falta documentación TSDoc sobre la declaración de tipo ${type}.`);
            return errors;
        }

        i--;
    }

    if (i < 0) {
        errors.push(`Error: No se encontró comentario TSDoc asociado a la declaración de tipo ${type}.`);
        return errors;
    }

    const commentBlock = lines.slice(i, declarationIndex).join('\n');
    const requiredTags = rules[type].requiredTags;

    requiredTags.forEach(tag => {
        if (!commentBlock.includes(tag)) {
            errors.push(`Error: Falta la etiqueta '${tag}' en la documentación de la ${type}.`);
        }
    });

    return errors;
}

/**
 * Valida un archivo basado en las líneas modificadas.
 */
function validateFile(filePath: string, changedLines: Set<number>): string[] {
    const errors: string[] = [];

    if (!existsSync(filePath)) {
        return [`Archivo inexistente: ${filePath}`];
    }

    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const changedIndices = Array.from(changedLines).map(line => line - 1);

    changedIndices.forEach(index => {
        const declType = determineDeclarationType(lines[index] || '');
        const fileErrors = validateDocumentation(lines, index, declType);

        if (fileErrors.length > 0) {
            errors.push(`Errores en la línea ${index + 1}:`);
            errors.push(...fileErrors.map(err => `  - ${err}`));
        }
    });

    return errors;
}

/**
 * Realiza la validación sobre los archivos cambiados.
 */
function runValidation(): boolean {
    try {
        const { lines: changedLines } = getChangedLines();
        const errorsByFile: Record<string, string[]> = {};
        let totalErrors = 0;

        for (const file in changedLines) {
            if (
                !file.endsWith('.ts') &&
                !file.endsWith('.tsx') &&
                !file.endsWith('.js') &&
                !file.endsWith('.jsx')
            ) {
                logDebug(`ℹ️ Archivo ignorado (no es código fuente): ${file}`);
                continue;
            }

            if (file.endsWith('tsdoc-validator.ts') || file.includes('node_modules/')) {
                // Ignorar el archivo del validador o dependencias externas
                continue;
            }

            const fullPath = path.resolve(file);
            logDebug(`📄 Validando archivo: ${fullPath}`);

            const errors = validateFile(fullPath, changedLines[file]);

            if (errors.length > 0) {
                errorsByFile[file] = errors;
                totalErrors += errors.length;
            } else {
                logDebug(`✅ Ningún problema encontrado en: ${fullPath}`);
            }
        }

        logValidationResult(errorsByFile, totalErrors);

        return totalErrors === 0;
    } catch (error) {
        logDebug(`❌ Error de validación: ${error}`);
        console.error('\n⚠️ **Error crítico al validar TSDoc.**');
        return false;
    }
}

// Punto de entrada principal
if (require.main === module) {
    process.exit(runValidation() ? 0 : 1);
}

export { runValidation };