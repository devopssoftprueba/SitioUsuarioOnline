import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import * as path from 'path';
import * as fs from "node:fs";

/**
 * Reglas de validación para TSDoc
 */
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

/**
 * Valida que las etiquetas requeridas existan y contengan información válida.
 */
function validateDocumentationContent(commentBlock: string, type: keyof typeof rules): string[] {
    const errors: string[] = [];
    const lines = commentBlock.split('\n').map(line => line.trim());

    rules[type].requiredTags.forEach(tag => {
        const matchingLine = lines.find(line => line.startsWith(tag));

        if (!matchingLine) {
            errors.push(`⚠️ Falta la etiqueta requerida '${tag}' en la documentación de '${type}'.`);
        } else {
            // Verifica que el contenido después de la etiqueta no esté vacío o sea inválido
            const content = matchingLine.replace(tag, '').trim();
            if (!content || content === '[TODO]' || content.length < 3) {
                errors.push(`⚠️ La etiqueta '${tag}' existe pero tiene contenido inválido o insuficiente en la documentación de '${type}'.`);
            }
        }
    });

    return errors;
}

/**
 * Valida una línea específica y verifica que cumpla las reglas de TSDoc.
 */
function validateDocumentation(
    lines: string[],
    declarationIndex: number,
    type: keyof typeof rules,
    changedLines: Set<number>
): string[] {
    const errors: string[] = [];
    let i = declarationIndex;

    // Retrocede para intentar encontrar el bloque de comentario TSDoc asociado
    while (i >= 0) {
        if (!changedLines.has(i + 1)) break; // Solo analiza líneas modificadas
        const line = lines[i]?.trim() || '';

        if (line.startsWith('/**')) break;

        if (line !== '' && !line.startsWith('//')) {
            errors.push(
                `⚠️ Error: Falta documentación TSDoc sobre la declaración de tipo '${type}' en la línea ${declarationIndex + 1}.`
            );
            return errors;
        }

        i--;
    }

    // Si no encontró un bloque de comentario TSDoc
    if (i < 0) {
        errors.push(
            `⚠️ Error: No se encontró comentario TSDoc asociado a la declaración de tipo '${type}' en la línea ${declarationIndex + 1}.`
        );
        return errors;
    }

    const commentBlock = lines.slice(i, declarationIndex).join('\n');

    // Validar contenido del bloque de comentarios
    const contentErrors = validateDocumentationContent(commentBlock, type);
    if (contentErrors.length > 0) {
        errors.push(...contentErrors);
    }

    return errors;
}
type ChangedLines = Record<string, Set<number>>;

function logDebug(message: string): void {
    console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
}

function logValidationResult(errorsByFile: Record<string, string[]>, totalErrors: number): void {
    if (totalErrors > 0) {
        console.log('\n❌ **Errores de validación TSDoc encontrados:**');
        console.log('------------------------------------------------------------------------------');

        for (const file in errorsByFile) {
            console.log(`📄 Archivo: ${file}`);
            console.log('───────────────────────────────────────────────────────────────────────────────');

            const uniqueErrors = Array.from(new Set(errorsByFile[file])); // Elimina duplicados
            uniqueErrors.forEach((error, index) => {
                console.log(`${index + 1}. ${error}`);
            });

            console.log('------------------------------------------------------------------------------');
        }

        console.log(`\n🔴 Total de errores únicos: ${totalErrors}`);
        console.log('❗ Por favor, corrige los errores de documentación antes de continuar.');
    } else {
        console.log('\n✅ **Validación TSDoc completada sin errores. ¡Buen trabajo!**');
    }
}

function getChangedLines(): { lines: ChangedLines } {
    try {
        const diffOutput = execSync('git diff --staged -U0 --no-color', { encoding: 'utf8' });
        const changedLines: ChangedLines = {};

        const fileRegex = /^diff --git a\/(.+?) b\/(.+)$/;
        const hunkRegex = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

        const lines = diffOutput.split('\n');
        let currentFile = '';

        lines.forEach((line) => {
            const fileMatch = line.match(fileRegex);
            if (fileMatch) {
                [, , currentFile] = fileMatch;
                return;
            }

            const hunkMatch = line.match(hunkRegex);
            if (hunkMatch && currentFile) {
                const startLine = parseInt(hunkMatch[1], 10);
                const lineCount = parseInt(hunkMatch[2] || '1', 10);
                if (!changedLines[currentFile]) changedLines[currentFile] = new Set<number>();
                for (let i = startLine; i < startLine + lineCount; i++) {
                    changedLines[currentFile].add(i);
                }
            }
        });

        return { lines: changedLines };
    } catch (error) {
        logDebug(`Error al obtener líneas modificadas: ${error}`);
        return { lines: {} };
    }
}

function determineDeclarationType(line: string): keyof typeof rules | null {
    const trimmed = line.trim();

    if (trimmed.startsWith('class ') || trimmed.startsWith('interface ') || trimmed.match(/^export\s+(class|interface)/)) {
        return 'class';
    }

    if (
        trimmed.startsWith('function ') ||
        trimmed.includes(' function') ||
        trimmed.includes('=>') ||
        trimmed.match(/^\w+\s*\(.*\)\s*:/)
    ) {
        return 'function';
    }

    if (trimmed.match(/^\w+\s*:\s*\w+/)) {
        return 'property';
    }

    return null;
}


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
                continue;
            }

            const fullPath = path.resolve(file);
            logDebug(`📄 Validando archivo: ${fullPath}`);

            const errors = validateDocumentation(
                fs.readFileSync(fullPath, 'utf8').split('\n'),
                0,
                determineDeclarationType(fullPath) || 'property',
                changedLines[file]
            );

            if (errors.length > 0) {
                errorsByFile[file] = errors;
                totalErrors += Array.from(new Set(errors)).length;
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

if (require.main === module) {
    process.exit(runValidation() ? 0 : 1);
}

export { runValidation };