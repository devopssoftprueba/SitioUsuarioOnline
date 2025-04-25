import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import rules from './tsdoc-rules'; // Importación de la exportación por defecto

function validateTSDoc(filePath: string) {
    const fileContent = readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n');
    let errors: string[] = [];

    // Validación para funciones
    lines.forEach((line, index) => {
        if (line.includes('function')) {
            const missingFunctionTags = rules.function.requiredTags.filter(tag => !line.includes(tag));
            if (missingFunctionTags.length > 0) {
                errors.push(`${index + 1} | ERROR | [x] La función no tiene los tags: ${missingFunctionTags.join(', ')}`);
            }
        }

        // Validación para clases
        if (line.includes('class')) {
            const missingClassTags = rules.class.requiredTags.filter(tag => !line.includes(tag));
            if (missingClassTags.length > 0) {
                errors.push(`${index + 1} | ERROR | [x] La clase no tiene los tags: ${missingClassTags.join(', ')}`);
            }
        }

        // Validación para propiedades
        if (line.includes('property')) {
            const missingPropertyTags = rules.property.requiredTags.filter(tag => !line.includes(tag));
            if (missingPropertyTags.length > 0) {
                errors.push(`${index + 1} | ERROR | [x] La propiedad no tiene los tags: ${missingPropertyTags.join(', ')}`);
            }
        }
    });

    return errors;
}

function runValidation() {
    const diff = execSync('git diff --name-only HEAD~1 HEAD').toString();
    const filesChanged = diff.split('\n').filter((file: string) => file.endsWith('.ts'));

    let validationResult = true;
    let allErrors: string[] = [];
    let totalErrors = 0;

    filesChanged.forEach((file: string) => {
        const errors = validateTSDoc(file);
        if (errors.length > 0) {
            allErrors.push(`\nArchivo: ${file}`);
            allErrors.push(`Total de errores: ${errors.length}`);
            allErrors.push(...errors);
            totalErrors += errors.length;
            validationResult = false;
        }
    });

    // Mostrar resumen
    if (allErrors.length > 0) {
        console.log('⚠️ Errores encontrados en la validación TSDoc:');
        allErrors.forEach(error => console.log(error));
        console.log(`\nTotal de errores: ${totalErrors}`);
    }

    return validationResult;
}

const result = runValidation();
if (!result) {
    console.error("❌ Validación de TSDoc fallida. Por favor, corrige los problemas de documentación antes de enviar los cambios.");
    process.exit(1);
} else {
    console.log("✅ La validación de TSDoc fue exitosa.");
}
