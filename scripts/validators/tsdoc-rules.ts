/**
 * TSDoc validation rules for different declaration types
 * Defines which tags are required for each type of declaration
 * @remarks This file contains the configuration for the TSDoc validator
 * @public
 */
const rules = {
    /**
     * Rules for class declarations
     * @remarks Defines required tags for classes, interfaces, enums, and namespaces
     * @public
     * @defaultValue Array of required tags
     */
    class: {
        requiredTags: ['@remarks', '@public', '@example', '@param'],
        // Classes should document their general purpose, constructor parameters and usage examples
    },

    /**
     * Rules for function declarations
     * @remarks Defines required tags for functions and methods
     * @public
     * @defaultValue Array of required tags
     */
    function: {
        requiredTags: ['@param', '@returns', '@throws', '@remarks'],
        // Functions should document their parameters, return value, exceptions and remarks
    },

    /**
     * Rules for property declarations
     * @remarks Defines required tags for properties and fields
     * @public
     * @defaultValue Array of required tags
     */
    property: {
        requiredTags: ['@remarks', '@public', '@defaultValue'],
        // Properties should document their purpose, visibility and default value
    },

    /**
     * Flag to enforce English documentation
     * @remarks When true, documentation must be written in English
     * @public
     * @defaultValue true
     */
    enforceEnglish: true,

    /**
     * List of common Spanish words to detect non-English documentation
     * @remarks Used to identify Spanish text in documentation blocks
     * @public
     * @defaultValue Array of Spanish words
     */
    spanishWords: [
        'para', 'como', 'este', 'esta', 'estos', 'estas', 'función', 'método', 'clase',
        'objeto', 'archivo', 'valor', 'variable', 'propiedad', 'retorna', 'devuelve',
        'utiliza', 'permite', 'contiene', 'obtiene', 'recibe', 'cuando', 'donde',
        'porque', 'ejemplo', 'datos', 'tiempo', 'usuario', 'número', 'lista', 'mensaje'
    ]
};

// Exportamos con type assertion para mantener compatibilidad con el código existente
export default rules;