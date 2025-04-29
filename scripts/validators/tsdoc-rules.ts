/**
 * TSDoc validation rules for different declaration types
 * Defines which tags are required for each type of declaration
 */
export default {
    class: {
        requiredTags: ['@remarks', '@public', '@example', '@param'],
        // Classes should document their general purpose, constructor parameters and usage examples
    },
    function: {
        requiredTags: ['@param', '@returns', '@throws', '@remarks'],
        // Functions should document their parameters, return value, exceptions and remarks
    },
    property: {
        requiredTags: ['@remarks', '@public', '@defaultValue'],
        // Properties should document their purpose, visibility and default value
    },
    enforceEnglish: true,
    // List of common Spanish words to detect documentation that is not in English
    spanishWords: [
        'para', 'como', 'este', 'esta', 'estos', 'estas', 'función', 'método', 'clase',
        'objeto', 'archivo', 'valor', 'variable', 'propiedad', 'retorna', 'devuelve',
        'utiliza', 'permite', 'contiene', 'obtiene', 'recibe', 'cuando', 'donde',
        'porque', 'ejemplo', 'datos', 'tiempo', 'usuario', 'número', 'lista', 'mensaje'
    ]
} as const;