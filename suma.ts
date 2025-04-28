import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import * as path from 'path';
import rules from './tsdoc-rules';

type ChangedLines = Record<string, Set<number>>;

/**
 * Obtiene las líneas modificadas de los archivos staged.
 *
 * @returns Un objeto con archivos y sus líneas modificadas.
 */
function getStagedChangedLines(): ChangedLines {
    const diffOutput = execSync('git diff --staged -U0 --no-color', { encoding: 'utf8' });
    const changedLines: ChangedLines = {};

    const fileRegex = /^diff --git a\/(.+?) b\/(.+)$/;
    const hunkRegex = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

    let currentFile = '';

    const lines = diffOutput.split('\n');
    for (const line of lines) {
        const fileMatch = line.match(fileRegex);
        if (fileMatch) {
            const [, , newFile] = fileMatch;
            currentFile = newFile;
            continue;
        }

        const hunkMatch = line.match(hunkRegex);
        if (hunkMatch) {
            const startLine = parseInt(hunkMatch[1], 10);
            const lineCount = hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1;
            const linesSet = changedLines[currentFile] || new Set<number>();
            for (let i = 0; i < lineCount; i++) {
                linesSet.add(startLine + i);
            }
            changedLines[currentFile] = linesSet;
        }
    }

    return changedLines;
}

/**
 * Busca la declaración de clase/método/propiedad más cercana hacia arriba.
 *
 * @param lines - Líneas del archivo.
 * @param startIndex - Índice desde donde buscar hacia arriba.
 * @returns El índice de la declaración encontrada, o -1 si no encuentra.
 */
function findDeclarationLine(lines: string[], startIndex: number): number {
    for (let i = startIndex; i >= 0; i--) {
        const trimmed = lines[i].trim();
        if (
            trimmed.startsWith('class ') ||
            trimmed.startsWith('interface ') ||
            trimmed.startsWith('function ') ||
            trimmed.match(/^[a-zA-Z0-9_]+\s*\(.*\)\s*{?$/) || // métodos
            trimmed.startsWith('public ') ||
            trimmed.startsWith('private ') ||
            trimmed.startsWith('protected ')
        ) {
            return i;
        }
    }
    return -1;
}

/**
 * Valida si una declaración tiene documentación inmediatamente arriba.
 *
 * @param lines - Líneas del archivo.
 * @param declarationIndex - Índice donde está la declaración.
 * @returns Lista de errores encontrados.
 */
function validateDocumentation(lines: string[], declarationIndex: number): string[] {
    const previousLineIndex = declarationIndex - 1;
    if (previousLineIndex < 0) {
        return ['No hay documentación encima de la declaración.'];
    }

    const trimmedPrev = lines[previousLineIndex].trim();
    if (!trimmedPrev.startsWith('/**')) {
        return ['Falta el bloque TSDoc encima de la declaración.'];
    }

    return [];
}

/**
 * Valida un archivo verificando documentación correcta en cambios.
 *
 * @param filePath - Ruta del archivo.
 * @param changed - Líneas cambiadas.
 * @returns Lista de errores encontrados.
 */
function validateFile(filePath: string, changed: Set<number>): string[] {
    const fileContent = readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n');
    const errors: string[] = [];

    const alreadyValidated = new Set<number>();

    changed.forEach(lineNumber => {
        const lineIndex = lineNumber - 1;

        const declarationIndex = findDeclarationLine(lines, lineIndex);
        if (declarationIndex === -1) return;

        if (alreadyValidated.has(declarationIndex)) return;
        alreadyValidated.add(declarationIndex);

        const validationErrors = validateDocumentation(lines, declarationIndex);
        if (validationErrors.length > 0) {
            const codeLine = lines[declarationIndex].trim();
            errors.push(`Error en línea ${declarationIndex + 1}: ${codeLine}`);
            errors.push(...validationErrors.map(e => `  - ${e}`));
        }
    });

    return errors;
}


function runValidation(): boolean {
    const changedLines = getStagedChangedLines();

    let validationResult = true;
    const allErrors: string[] = [];

    for (const file in changedLines) {
        if (
            !file.endsWith('.ts') &&
            !file.endsWith('.tsx') &&
            !file.endsWith('.js') &&
            !file.endsWith('.jsx')
        ) continue;

        if (file.endsWith('tsdoc-validator.ts')) continue; // evita auto-validarse

        const fullPath = path.resolve(file);
        const errors = validateFile(fullPath, changedLines[file]);

        if (errors.length > 0) {
            allErrors.push(`\nArchivo: ${file}`);
            allErrors.push(...errors);
            validationResult = false;
        }
    }

    if (!validationResult) {
        console.log('⚠️  Errores encontrados en la validación TSDoc:');
        allErrors.forEach(error => console.log(error));
        console.log(`\nTotal de errores: ${allErrors.length}`);
    }

    return validationResult;
}

// Ejecuta el validador si este archivo es llamado directamente
if (require.main === module) {
    const result = runValidation();
    process.exit(result ? 0 : 1);
}
