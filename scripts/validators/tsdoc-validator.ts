import { TSDocParser } from '@microsoft/tsdoc';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// Archivos permitidos
const FILE_REGEX = /\.(ts|tsx|js|jsx)$/;

// Tipos de declaraciones a validar
const DECLARATION_REGEX = /^\+.*?(function|class|interface|type|enum)\s+(\w+)/;

// Obtener archivos con cambios staged
function getStagedFiles(): string[] {
    const output = execSync('git diff --staged --name-only --diff-filter=ACM', {
        encoding: 'utf-8'
    });

    return output.split('\n').filter(file =>
        FILE_REGEX.test(file) && fs.existsSync(file)
    );
}

// Validar un archivo completo
function validateFile(filePath: string): string[] {
    const diff = execSync(`git diff --staged ${filePath}`, { encoding: 'utf-8' });
    const addedLines = diff.split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++'));

    const source = fs.readFileSync(filePath, 'utf-8');
    const lines = source.split('\n');
    const errors: string[] = [];

    const parser = new TSDocParser();

    for (let i = 0; i < addedLines.length; i++) {
        const line = addedLines[i].slice(1); // quitar el "+"

        const match = line.match(DECLARATION_REGEX);
        if (!match) continue;

        const type = match[1];
        const name = match[2];

        const originalLineIndex = lines.findIndex(l => l.includes(match[0].substring(1)));
        if (originalLineIndex === -1) continue;

        const docBlock = lines[originalLineIndex - 1];
        const hasDoc = docBlock && docBlock.trim().startsWith('/**');

        if (!hasDoc) {
            errors.push(`🔴 Falta documentación para ${type} "${name}" en ${filePath}`);
            continue;
        }

        const parsed = parser.parseString(docBlock);
        if (parsed.log.messages.length > 0) {
            errors.push(`🔴 Documentación inválida para ${type} "${name}" en ${filePath}`);
        }
    }

    return errors;
}

// Ejecutar la validación
function runValidator() {
    const files = getStagedFiles();
    let allErrors: string[] = [];

    files.forEach(file => {
        const errors = validateFile(file);
        if (errors.length > 0) {
            allErrors = allErrors.concat(errors);
        }
    });

    if (allErrors.length > 0) {
        console.log('\n❌ Errores de documentación encontrados:\n');
        allErrors.forEach(e => console.log(e));
        process.exit(1); // ❗❗ Bloquea el push
    } else {
        console.log('✅ Todos los archivos pasaron la validación.');
        process.exit(0);
    }
}

runValidator();
