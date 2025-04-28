import { execSync } from 'child_process';
import rules from './tsdoc-rules'; // Importación de reglas

/**
 * Valida un fragmento de líneas nuevas.
 */
function validateTSDocFragment(lines: string[]) {
    let errors: string[] = [];

    lines.forEach((line, index) => {
        // Validar función
        if (line.includes('function')) {
            const missingFunctionTags = rules.function.requiredTags.filter(tag => !line.includes(tag));
            if (missingFunctionTags.length > 0) {
                errors.push(`${index + 1} | ERROR | [x] La función no tiene los tags: ${missingFunctionTags.join(', ')}`);
            }
        }

        // Validar clase
        if (line.includes('class')) {
            const missingClassTags = rules.class.requiredTags.filter(tag => !line.includes(tag));
            if (missingClassTags.length > 0) {
                errors.push(`${index + 1} | ERROR | [x] La clase no tiene los tags: ${missingClassTags.join(', ')}`);
            }
        }

        // Validar propiedad
        if (line.includes('property')) {
            const missingPropertyTags = rules.property.requiredTags.filter(tag => !line.includes(tag));
            if (missingPropertyTags.length > 0) {
                errors.push(`${index + 1} | ERROR | [x] La propiedad no tiene los tags: ${missingPropertyTags.join(', ')}`);
            }
        }
    });

    return errors;
}

/**
 * Obtiene las líneas nuevas agregadas en git staged.
 */
function getChangedLines(): Record<string, string[]> {
    const changedLines: Record<string, string[]> = {};

    try {
        const diffOutput = execSync('git diff --staged -U0', { encoding: 'utf8' });

        let currentFile = '';
        const lines = diffOutput.split('\n');

        for (const line of lines) {
            if (line.startsWith('+++ b/')) {
                currentFile = line.replace('+++ b/', '').trim();
                continue;
            }

            if (currentFile && line.startsWith('+') && !line.startsWith('+++')) {
                if (!changedLines[currentFile]) {
                    changedLines[currentFile] = [];
                }
                changedLines[currentFile].push(line.substring(1)); // quitar '+'
            }
        }
    } catch (error) {
        console.error('Error al obtener el git diff:', error);
    }

    return changedLines;
}

function runValidation() {
    const changedLines = getChangedLines();

    if (Object.keys(changedLines).length === 0) {
        console.log('✅ No hay cambios staged. Se omite validación de TSDoc.');
        return true;
    }

    let validationResult = true;
    let allErrors: string[] = [];
    let totalErrors = 0;

    for (const [filePath, lines] of Object.entries(changedLines)) {
        if (
            (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.js') || filePath.endsWith('.jsx')) &&
            !filePath.includes('scripts/validators/')
        ) {
            const errors = validateTSDocFragment(lines);

            if (errors.length > 0) {
                allErrors.push(`\nArchivo: ${filePath}`);
                allErrors.push(`Total de errores: ${errors.length}`);
                allErrors.push(...errors);
                totalErrors += errors.length;
                validationResult = false;
            }
        }
    }

    if (!validationResult) {
        console.log('⚠️ Errores encontrados en la validación TSDoc:');
        allErrors.forEach(error => console.log(error));
        console.log(`\nTotal de errores: ${totalErrors}`);
    }

    return validationResult;
}

// Ejecutar validación
const result = runValidation();
if (!result) {
    console.error("❌ Validación de TSDoc fallida. Por favor, corrige los problemas de documentación antes de enviar los cambios.");
    process.exit(1);
} else {
    console.log("✅ La validación de TSDoc fue exitosa.");
}
