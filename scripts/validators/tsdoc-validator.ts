import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import * as path from 'path';
import rules from './tsdoc-rules';

type ChangedLines = Record<string, Set<number>>;

/**
 * Log with timestamp for debugging
 *
 * @param message - The message to log
 */
function logDebug(message: string): void {
    console.log(`[${new Date().toISOString()}] ${message}`);
}

logDebug('🔍 TSDoc validator running...');

/**
 * Obtiene las líneas modificadas de los archivos en el push actual.
 *
 * @returns Un objeto con archivos y sus líneas modificadas.
 */
function getChangedLines(): ChangedLines {
    try {
        // Get the current branch name
        const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();

        // Check if the branch exists on remote
        const remoteExists = execSync(`git ls-remote --heads origin ${currentBranch}`, { encoding: 'utf8' }).trim();

        let diffCommand;
        if (remoteExists) {
            // If branch exists on remote, compare with it
            diffCommand = `git diff origin/${currentBranch}..HEAD -U0 --no-color`;
            logDebug(`Comparing with remote branch: origin/${currentBranch}`);
        } else {
            // If it's a new branch, get all changes in the branch
            // Find the merge-base with main/master/develop
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
                        // Fall back to using staged changes if no common base branch found
                        diffCommand = 'git diff --staged -U0 --no-color';
                        logDebug('No remote branch found. Using staged changes.');
                    }
                }
            }

            if (!diffCommand) {
                diffCommand = `git diff origin/${baseBranch}..HEAD -U0 --no-color`;
                logDebug(`New branch detected. Comparing with ${baseBranch}.`);
            }
        }

        logDebug(`Running diff command: ${diffCommand}`);
        const diffOutput = execSync(diffCommand, { encoding: 'utf8' });
        logDebug(`Diff output length: ${diffOutput.length} bytes`);

        const changedLines: ChangedLines = {};

        const fileRegex = /^diff --git a\/(.+?) b\/(.+)$/;
        const hunkRegex = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

        let currentFile = '';

        const lines = diffOutput.split('\n');
        logDebug(`Processing ${lines.length} lines of diff output`);

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

        logDebug(`Found changes in ${Object.keys(changedLines).length} files`);
        return changedLines;
    } catch (error) {
        logDebug(`Error getting changed lines: ${error}`);
        return {};
    }
}

/**
 * Determina el tipo de declaración basándose en la línea de código.
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

    return 'function'; // Default fallback
}

/**
 * Busca la declaración de clase/metodo/propiedad más cercana hacia arriba.
 *
 * @param lines - Líneas del archivo.
 * @param startIndex - Índice desde donde buscar hacia arriba.
 * @returns El índice de la declaración encontrada y su tipo, o null si no encuentra.
 */
function findDeclarationLine(lines: string[], startIndex: number): { index: number; type: keyof typeof rules } | null {
    for (let i = startIndex; i >= 0; i--) {
        const trimmed = lines[i].trim();
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
            return {
                index: i,
                type: determineDeclarationType(trimmed)
            };
        }
    }
    return null;
}

/**
 * Verifica si existe un bloque de documentación TSDoc válido para una declaración.
 *
 * @param lines - Líneas del archivo
 * @param declarationIndex - Índice donde está la declaración
 * @param type - Tipo de declaración
 * @returns Lista de errores encontrados
 */
function validateDocumentation(lines: string[], declarationIndex: number, type: keyof typeof rules): string[] {
    // Buscar hacia arriba para encontrar un bloque de comentarios
    let i = declarationIndex - 1;

    // Saltar líneas vacías
    while (i >= 0 && lines[i].trim() === '') {
        i--;
    }

    // Si no hay línea previa o no es un cierre de comentario
    if (i < 0 || lines[i].trim() !== '*/') {
        return [`Error: Falta el bloque TSDoc encima de la declaración de tipo ${type}.`];
    }

    // Encontrar el inicio del bloque de comentarios
    let startCommentIndex = i;
    while (startCommentIndex >= 0 && !lines[startCommentIndex].trim().startsWith('/**')) {
        startCommentIndex--;
    }

    if (startCommentIndex < 0) {
        return [`Error: Se encontró un cierre de comentario sin apertura para la declaración de tipo ${type}.`];
    }

    // Extraer el bloque completo de comentarios
    const commentBlock = lines.slice(startCommentIndex, i + 1).join('\n');

    // Verificar etiquetas requeridas
    const requiredTags = rules[type]?.requiredTags || [];
    const missingTags = requiredTags.filter(tag => !commentBlock.includes(tag));

    if (missingTags.length > 0) {
        return [`Error: La declaración de tipo ${type} falta las siguientes etiquetas: ${missingTags.join(', ')}.`];
    }

    return []; // La documentación es válida
}

/**
 * Valida un archivo verificando documentación correcta en cambios.
 *
 * @param filePath - Ruta del archivo.
 * @param changed - Líneas cambiadas.
 * @returns Lista de errores encontrados.
 */
function validateFile(filePath: string, changed: Set<number>): string[] {
    try {
        if (!existsSync(filePath)) {
            logDebug(`File not found: ${filePath}`);
            return [`Error: File not found - ${filePath}`];
        }

        const fileContent = readFileSync(filePath, 'utf8');
        const lines = fileContent.split('\n');
        const errors: string[] = [];

        const alreadyValidated = new Set<number>();

        changed.forEach(lineNumber => {
            const lineIndex = lineNumber - 1;
            if (lineIndex < 0 || lineIndex >= lines.length) return;

            const declaration = findDeclarationLine(lines, lineIndex);
            if (!declaration) return;

            const { index: declarationIndex, type } = declaration;

            if (alreadyValidated.has(declarationIndex)) return;
            alreadyValidated.add(declarationIndex);

            logDebug(`Validating ${type} at line ${declarationIndex + 1} in ${filePath}`);

            const validationErrors = validateDocumentation(lines, declarationIndex, type);
            if (validationErrors.length > 0) {
                const codeLine = lines[declarationIndex].trim();
                errors.push(`Error en línea ${declarationIndex + 1}: ${codeLine}`);
                errors.push(...validationErrors.map(e => `  - ${e}`));
            }
        });

        return errors;

    } catch (error) {
        logDebug(`Error validating file ${filePath}: ${error}`);
        return [`Error validating file ${filePath}: ${error}`];
    }
}

/**
 * Ejecuta la validación sobre todos los archivos con cambios.
 *
 * @returns True si pasa la validación, false si hay errores.
 */
function runValidation(): boolean {
    try {
        const changedLines = getChangedLines();

        let validationResult = true;
        const allErrors: string[] = [];

        for (const file in changedLines) {
            if (
                !file.endsWith('.ts') &&
                !file.endsWith('.tsx') &&
                !file.endsWith('.js') &&
                !file.endsWith('.jsx')
            ) {
                logDebug(`Skipping non-JavaScript/TypeScript file: ${file}`);
                continue;
            }

            if (file.endsWith('tsdoc-validator.ts') || file.includes('node_modules/')) {
                logDebug(`Skipping excluded file: ${file}`);
                continue;
            }

            const fullPath = path.resolve(file);
            logDebug(`Validating file: ${fullPath}`);

            const errors = validateFile(fullPath, changedLines[file]);

            if (errors.length > 0) {
                allErrors.push(`\nArchivo: ${file}`);
                allErrors.push(...errors);
                validationResult = false;
            }
        }

        if (!validationResult) {
            console.log('\n⚠️  Errores encontrados en la validación TSDoc:');
            allErrors.forEach(error => console.log(error));
            console.log(`\nTotal de errores: ${allErrors.length}`);
            console.log('\nAsegúrate de documentar correctamente todas las nuevas declaraciones.');
        } else {
            logDebug('✅ Validación TSDoc completada sin errores.');
        }

        return validationResult;
    } catch (error) {
        logDebug(`Error en la validación: ${error}`);
        console.error(`\n⚠️  Error en la validación TSDoc: ${error}`);
        return false; // En caso de error, bloqueamos el push
    }
}

// Ejecuta el validador si este archivo es llamado directamente
if (require.main === module) {
    const result = runValidation();
    process.exit(result ? 0 : 1);
}

export { runValidation };