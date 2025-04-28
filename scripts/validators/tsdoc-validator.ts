import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import * as path from 'path';

type ChangedLines = Record<string, Set<number>>;

/**
 * Obtiene las líneas modificadas o agregadas en el área de staging.
 *
 * @returns Registro de archivos con líneas cambiadas.
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
 * Valida si existe un bloque de documentación TSDoc encima de una línea de código.
 *
 * @param lines Contenido del archivo dividido en líneas.
 * @param index Índice de la línea donde está la definición.
 * @returns `true` si encontró documentación arriba, `false` si no.
 */
function hasDocumentationAbove(lines: string[], index: number): boolean {
    let i = index - 1;

    while (i >= 0) {
        const line = lines[i].trim();
        if (line === '') {
            i--;
            continue; // saltar líneas vacías
        }
        if (line.startsWith('/**')) {
            return true; // encontró inicio de TSDoc
        }
        if (line.startsWith('//') || line.startsWith('/*')) {
            return false; // comentario que no es TSDoc
        }
        // encontró código real, sin comentarios
        return false;
    }

    return false;
}

/**
 * Valida el archivo verificando que todas las clases, métodos y propiedades nuevas/modificadas tengan documentación.
 *
 * @param filePath Ruta del archivo.
 * @param changed Líneas cambiadas en el archivo.
 * @returns Lista de errores encontrados.
 */
function validateFile(filePath: string, changed: Set<number>): string[] {
    const fileContent = readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n');
    let errors: string[] = [];

    lines.forEach((line, index) => {
        if (!changed.has(index + 1)) return; // +1 porque git diff empieza en 1

        const trimmed = line.trim();

        // Detecta métodos, clases o propiedades
        const isFunction = trimmed.startsWith('function ') || trimmed.includes('function ');
        const isClass = trimmed.startsWith('class ');
        const isProperty = (
            (trimmed.startsWith('public') || trimmed.startsWith('private') || trimmed.startsWith('protected')) &&
            trimmed.includes(':')
        );

        if (isFunction || isClass || isProperty) {
            if (!hasDocumentationAbove(lines, index)) {
                errors.push(`${index + 1} | ERROR | [x] Falta documentación encima de ${isFunction ? 'función' : isClass ? 'clase' : 'propiedad'}`);
            }
        }
    });

    return errors;
}

/**
 * Ejecuta toda la validación TSDoc.
 *
 * @returns `true` si pasó toda la validación, `false` si hubo errores.
 */
function runValidation(): boolean {
    const changedLines = getStagedChangedLines();

    let validationResult = true;
    let allErrors: string[] = [];

    for (const file in changedLines) {
        if (
            !file.endsWith('.ts') &&
            !file.endsWith('.tsx') &&
            !file.endsWith('.js') &&
            !file.endsWith('.jsx')
        ) continue;

        if (file.endsWith('tsdoc-validator.ts')) continue; // evitar autovalidar este script

        const fullPath = path.resolve(file);
        const errors = validateFile(fullPath, changedLines[file]);

        if (errors.length > 0) {
            allErrors.push(`\nArchivo: ${file}`);
            allErrors.push(...errors);
            validationResult = false;
        }
    }

    if (!validationResult) {
        console.log('⚠️ Errores encontrados en la validación TSDoc:');
        allErrors.forEach(e => console.log(e));
        console.log(`\nTotal de errores: ${allErrors.length}`);
    }

    return validationResult;
}

// Ejecutar la validación
if (!runValidation()) {
    process.exit(1); // Bloquear el push si falla
}
