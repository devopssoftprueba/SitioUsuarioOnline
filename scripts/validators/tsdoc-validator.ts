import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import rules from './tsdoc-rules'; // Importación de la exportación por defecto


function validateTSDoc(filePath: string) {
    const fileContent = readFileSync(filePath, 'utf8');

    // Validación para funciones
    if (fileContent.includes('function')) {
        const missingFunctionTags = rules.function.requiredTags.filter(tag => !fileContent.includes(tag));
        if (missingFunctionTags.length > 0) {
            console.log(`ERROR: La función no tiene los tags: ${missingFunctionTags.join(', ')}`);
            return false;
        }
    }

    // Validación para clases
    if (fileContent.includes('class')) {
        const missingClassTags = rules.class.requiredTags.filter(tag => !fileContent.includes(tag));
        if (missingClassTags.length > 0) {
            console.log(`ERROR: La clase no tiene los tags: ${missingClassTags.join(', ')}`);
            return false;
        }
    }

    // Validación para propiedades
    if (fileContent.includes('property')) {
        const missingPropertyTags = rules.property.requiredTags.filter(tag => !fileContent.includes(tag));
        if (missingPropertyTags.length > 0) {
            console.log(`ERROR: La propiedad no tiene los tags: ${missingPropertyTags.join(', ')}`);
            return false;
        }
    }

    return true;
}

function runValidation() {
    const diff = execSync('git diff --name-only HEAD~1 HEAD').toString();
    const filesChanged = diff.split('\n').filter((file: string) => file.endsWith('.ts'));

    let validationResult = true;

    filesChanged.forEach((file: string) => {
        const result = validateTSDoc(file);
        if (!result) {
            validationResult = false;
        }
    });

    return validationResult;
}

const result = runValidation();
if (!result) {
    console.error("La validación de TSDoc falló. Revisa los archivos modificados.");
    process.exit(1);
} else {
    console.log("La validación de TSDoc fue exitosa.");
}
