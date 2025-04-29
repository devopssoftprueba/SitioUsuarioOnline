
class ExampleClass {
 
    exampleMethod(param12: string, param2: number): string {
        return `Param12: ${param12}, Param2: ${param2}`;
    }

    /**
     * Propiedad de ejemplo que almacena un mensaje.
     *
     * @var {string} exampleProperty - Mensaje de ejemplo.
     * @category Ejemplo
     * @package ejemplo
     * @author Ronald
     * @version 1.0.0
     * @since 2025-04-28
     * @description Esta propiedad almacena un mensaje de ejemplo que puede ser utilizado en otras partes del código.
     */
    exampleProperty: string = 'hola World';


}

/**
 * agrego esto en español as.
 *
 * @param radius - El radio del círculo.
 * @returns El área del círculo calculada con la fórmula `π * radius^2`.
 * @category Math
 * @package Geometry
 * @author Ronald
 * @version 1.0.0
 * @since 2025-04-28
 * @description Esta función toma el radio de un círculo y devuelve su área.
 */
function calculateCircleArea(radius: number): number {
    return Math.PI * Math.pow(radius, 2);
}

