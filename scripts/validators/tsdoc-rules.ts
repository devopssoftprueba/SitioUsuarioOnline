// tsdoc-rules.ts

// Reglas para los tipos de declaraciones
export default {
    class: {
        requiredTags: ['@category', '@package', '@author', '@version', '@since', '@description'],
    },
    function: {
        requiredTags: ['@category', '@package', '@author', '@version', '@since', '@param', '@return', '@description'],
    },
    property: {
        requiredTags: ['@category', '@package', '@author', '@version', '@since', '@var', '@description'],
    },
};
