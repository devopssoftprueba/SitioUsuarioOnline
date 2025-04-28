import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import * as path from 'path';
import rules from './tsdoc-rules';

type ChangedLines = Record<string, Set<number>>;

function getStagedChangedLines(): ChangedLines {
    const diffOutput = execSync('git diff --staged -U0 --no-color', { encoding: 'utf8' });
    const changedLines: ChangedLines = {};

    const fileRegex = /^diff --git a\/(.+?) b\/(.+)$/;
    const hunkRegex = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

    let currentFile = '';
    let currentLine = 0;

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

function validateLine(line: string, index: number, type: keyof typeof rules): string[] {
    const missingTags = rules[type].requiredTags.filter(tag => !line.includes(tag));
    if (missingTags.length > 0) {
        return [`${index + 1} | ERROR | [x] La ${type} no tiene los tags: ${missingTags.join(', ')}`];
    }
    return [];
}

function validateFile(filePath: string, changed: Set<number>): string[] {
    const fileContent = readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n');
    let errors: string[] = [];

    lines.forEach((line, index) => {
        if (!changed.has(index + 1)) return;

        const trimmed = line.trim();

        if (trimmed.startsWith('function') || trimmed.includes('function ')) {
            errors.push(...validateLine(trimmed, index, 'function'));
        }

        if (trimmed.startsWith('class ')) {
            errors.push(...validateLine(trimmed, index, 'class'));
        }

        if (trimmed.startsWith('private') || trimmed.startsWith('public') || trimmed.includes(':') && trimmed.includes(';')) {
            errors.push(...validateLine(trimmed, index, 'property'));
        }
    });

    return errors;
}

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

        // Evita validarse a sí mismo
        if (file.endsWith('tsdoc-validator.ts')) continue;

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

/**
 * Clase que representa un servicio de utilidades para operaciones matemáticas básicas.
 *
 * @category Utilities
 * @package utils
 * @author Ronald
 * @version 1.0.0
 * @since 2025-04-28
 */
export class MathService {
    /**
     * Suma dos números y devuelve el resultado.
     *
     * @param a - Primer número a sumar.
     * @param b - Segundo número a sumar.
     * @returns Resultado de la suma de `a` y `b`.
     */
    public add(a: number, b: number): number {
        return a + b;
    }

    public subtract(a: number, b: number): number {
        return a - b;
    }

    /**
     * Multiplica dos números y devuelve el resultado.
     *
     * @param a - Primer número a multiplicar.
     * @param b - Segundo número a multiplicar.
     * @returns Resultado de la multiplicación de `a` por `b`.
     */
    public multiply(a: number, b: number): number {
        return a * b;
    }


    public divide(a: number, b: number): number {
        if (b === 0) {
            throw new Error('Division by zero is not allowed.');
        }
        return a / b;
    }
}
