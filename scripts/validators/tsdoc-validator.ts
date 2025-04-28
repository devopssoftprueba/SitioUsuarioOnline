import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import * as path from 'path';
import rules from './tsdoc-rules';  // Asegúrate de que esta importación sea utilizada

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
 * Busca la declaración de clase/metodo/propiedad más cercana hacia arriba.
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
 * Valida si una declaración tiene documentación inmediatamente arriba, usando reglas.
 *
 * @param lines - Líneas del archivo.
 * @param declarationIndex - Índice donde está la declaración.
 * @param type - Tipo de declaración (metodo, clase, propiedad).
 * @returns Lista de errores encontrados.
 */
function validateDocumentation(lines: string[], declarationIndex: number, type: keyof typeof rules): string[] {
    const previousLineIndex = declarationIndex - 1;
    if (previousLineIndex < 0) {
        return [`Error: No hay documentación encima de la declaración de tipo ${type}.`];
    }

    const trimmedPrev = lines[previousLineIndex].trim();
    if (!trimmedPrev.startsWith('/**')) {
        return [`Error: Falta el bloque TSDoc encima de la declaración de tipo ${type}.`];
    }

    // Reglas específicas de documentación
    const requiredTags = rules[type]?.requiredTags || [];
    const missingTags = requiredTags.filter(tag => !trimmedPrev.includes(tag));

    if (missingTags.length > 0) {
        return [`Error: La declaración de tipo ${type} falta las siguientes etiquetas: ${missingTags.join(', ')}.`];
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

        // Determinar tipo de declaración
        let type: keyof typeof rules = 'function'; // Default

        if (lines[declarationIndex].includes('class')) {
            type = 'class';
        } else if (lines[declarationIndex].includes('interface')) {
            type = 'class'; // Asumir que las interfaces son como clases para la validación
        } else if (lines[declarationIndex].includes('public') || lines[declarationIndex].includes('private') || lines[declarationIndex].includes('protected')) {
            type = 'property'; // Asumir que cualquier propiedad va aquí
        }

        const validationErrors = validateDocumentation(lines, declarationIndex, type);
        if (validationErrors.length > 0) {
            const codeLine = lines[declarationIndex].trim();
            errors.push(`Error en línea ${declarationIndex + 1}: ${codeLine}`);
            errors.push(...validationErrors.map(e => `  - ${e}`));
        }
    });

    return errors;
}

/**
 * Ejecuta la validación sobre todos los archivos staged.
 *
 * @returns True si pasa la validación, false si hay errores.
 */
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
