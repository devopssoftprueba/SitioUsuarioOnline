// Asegúrate de exportar las reglas correctamente
const rules = {
    function: {
        requiredTags: ['@param', '@returns'],
    },
    class: {
        requiredTags: ['@description'],
    },
    property: {
        requiredTags: ['@type'],
    },
};

export default rules; // Usar exportación por defecto
