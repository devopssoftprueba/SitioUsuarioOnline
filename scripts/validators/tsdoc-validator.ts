// Importa la función execSync del módulo child_process para ejecutar comandos de terminal
import { execSync } from 'child_process';
// Importa las funciones readFileSync y existsSync del módulo fs para leer archivos y verificar su existencia
import { readFileSync, existsSync } from 'fs';
// Importa todas las funcionalidades del módulo path para manejar rutas de archivos
import * as path from 'path';

// Reglas para validación de documentación
const rules = {
    'class': {
        requiredTags: [],
        optionalTags: ['@description', '@example', '@remarks', '@deprecated', '@category', '@package',
            '@author', '@version', '@since', '@decorator', '@view'],
    },
    'function': {
        requiredTags: [],
        optionalTags: ['@param', '@returns', '@throws', '@example', '@remarks', '@deprecated',
            '@method', '@event', '@computed'],
    },
    'property': {
        requiredTags: [],
        optionalTags: ['@description', '@defaultValue', '@remarks', '@deprecated', '@prop',
            '@data', '@input', '@output', '@property'],
    },
};

// Función para registrar mensajes de depuración con marca de tiempo
function logDebug(message: string): void {
    console.log(`[${new Date().toISOString()}] ${message}`);
}

// Función para obtener las líneas modificadas
function getChangedLines(): Record<string, Set<number>> {
    try {
        const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
        const remoteExists = execSync(`git ls-remote --heads origin ${currentBranch}`, { encoding: 'utf8' }).trim();

        let diffCommand;
        if (remoteExists) {
            diffCommand = `git diff origin/${currentBranch}..HEAD -U3 --no-color`;
            logDebug(`Comparando con rama remota: origin/${currentBranch}`);
        } else {
            let baseBranch = 'main';
            try {
                execSync('git rev-parse --verify origin/main', { stdio: 'pipe' });
            } catch {
                try {
                    execSync('git rev-parse --verify origin/master', { stdio: 'pipe' });
                    baseBranch = 'master';
                } catch {
                    try {
                        execSync('git rev-parse --verify origin/develop', { stdio: 'pipe' });
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

        logDebug(`Ejecutando comando diff: ${diffCommand}`);
        const diffOutput = execSync(diffCommand, { encoding: 'utf8' });
        logDebug(`Longitud de la salida diff: ${diffOutput.length} bytes`);

        const changedLines: Record<string, Set<number>> = {};
        const fileRegex = /^diff --git a\/(.+?) b\/(.+)$/;
        const hunkRegex = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

        let currentFile = '';
        for (const line of diffOutput.split('\n')) {
            const fileMatch = line.match(fileRegex);
            if (fileMatch) {
                currentFile = fileMatch[2];
                continue;
            }
            const hunkMatch = line.match(hunkRegex);
            if (hunkMatch && currentFile) {
                const startLine = parseInt(hunkMatch[1], 10);
                const lineCount = hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1;
                if (!changedLines[currentFile]) changedLines[currentFile] = new Set();
                for (let i = 0; i < lineCount; i++) changedLines[currentFile].add(startLine + i);
            }
        }
        return changedLines;
    } catch (error) {
        logDebug(`Error al obtener líneas cambiadas: ${error}`);
        return {};
    }
}

// Función para determinar el tipo de declaración
function determineDeclarationType(line: string): keyof typeof rules {
    const trimmed = line.trim();
    if (trimmed.startsWith('class ') || trimmed.startsWith('interface ')) return 'class';
    if (trimmed.startsWith('function ') || /^[a-zA-Z0-9_]+\s*\(.*\)\s*{?$/.test(trimmed)) return 'function';
    if (/^[a-zA-Z0-9_]+\s*[:=]/.test(trimmed)) return 'property';
    return 'function';
}

// Función para encontrar la declaración más cercana hacia arriba
function findDeclarationLine(lines: string[], startIndex: number): { index: number; type: keyof typeof rules } | null {
    for (let i = startIndex; i >= 0; i--) {
        const trimmed = lines[i].trim();
        if (trimmed === '' || trimmed.startsWith('/**') || trimmed.startsWith('*') || trimmed === '*/') continue;
        const type = determineDeclarationType(trimmed);
        if (type) return { index: i, type };
    }
    return null;
}

// Función para validar documentación en inglés
function validateEnglishDocumentation(commentBlock: string): string[] {
    const spanishWords = ['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'para', 'por', 'con', 'sin', 'porque', 'como', 'cuando', 'si', 'pero', 'aunque', 'español'];
    const cleanedComment = commentBlock.replace(/\n/g, ' ').toLowerCase();
    const foundSpanishWords = spanishWords.filter(word => new RegExp(`\\b${word}\\b`).test(cleanedComment));
    if (foundSpanishWords.length > 0) {
        return [`Error: La documentación contiene palabras en español: ${foundSpanishWords.join(', ')}.`];
    }
    return [];
}

// Función para validar un bloque de comentarios y su declaración
function validateDocumentation(lines: string[], declarationIndex: number, type: keyof typeof rules): string[] {
    let i = declarationIndex - 1;
    while (i >= 0 && !lines[i].trim().startsWith('/**')) i--;
    if (i < 0) return [`Error: Falta el bloque TSDoc sobre la declaración de ${type}.`];
    const commentBlock = lines.slice(i, declarationIndex).join('\n');
    return validateEnglishDocumentation(commentBlock);
}

// Función para validar un archivo completo
function validateFile(filePath: string, changed: Set<number>): string[] {
    if (!existsSync(filePath)) return [`Archivo eliminado: ${filePath}`];
    const errors: string[] = [];
    const lines = readFileSync(filePath, 'utf8').split('\n');
    changed.forEach(lineNumber => {
        const declaration = findDeclarationLine(lines, lineNumber - 1);
        if (declaration) {
            errors.push(...validateDocumentation(lines, declaration.index, declaration.type));
        }
    });
    return errors;
}

// Función principal para ejecutar la validación
function runValidation(): boolean {
    const changedFiles = getChangedLines();
    const allErrors: string[] = [];
    for (const [filePath, changed] of Object.entries(changedFiles)) {
        if (!filePath.endsWith('.ts')) continue;
        allErrors.push(...validateFile(path.resolve(filePath), changed));
    }
    if (allErrors.length > 0) {
        console.error('Errores encontrados:', allErrors);
        return false;
    }
    console.log('✅ Validación TSDoc completada sin errores.');
    return true;
}

// Ejecutar validación si se llama directamente
if (require.main === module) {
    process.exit(runValidation() ? 0 : 1);
}