/**
 * ExampleClass demuestra la estructura básica con un metodo y una propiedad documentados.
 *
 * @category Ejemplo
 * @package ejemplo
 * @author Ronald
 * @version 1.0.0
 * @since 2025-04-28
 * @description Esta clase incluye un metodo de ejemplo y una propiedad para ilustrar la documentación adecuada usando TSDoc.
 */
class ExampleClass {
    /**
     * Devuelve una cadena formateada con ambos parámetros de entrada.
     *
     * @param param12 - Un parámetro de tipo cadena que se mostrará en el resultado.
     * @param param2 - Un parámetro numérico que se mostrará en el resultado.
     * @returns Una cadena formateada que incluye ambos parámetros.
     * @category Ejemplo
     * @package ejemplo
     * @author Ronald
     * @version 1.0.0
     * @since 2025-04-28
     * @description Este metodo devuelve una cadena formateada usando los parámetros proporcionados.
     */
    exampleMethod(param12: string, param2: number): string {
        return `Param12: ${param12}, Param2: ${param2}`;
    }

    /**
     * Propiedad de ejemplo que almacena un mensaje.
     *
     * @var {string} exampleProperty - Mensaje que se utilizará en otras partes del código.
     * @category Ejemplo
     * @package ejemplo
     * @author Ronald
     * @version 1.0.0
     * @since 2025-04-28
     * @description Esta propiedad almacena un mensaje de ejemplo que puede usarse en otras partes del código.
     */
    exampleProperty: string = 'Hello World';
}

/**
 * Calcula el área de un círculo usando el radio proporcionado.
 *
 * @param radius - El radio del círculo.
 * @returns El área del círculo se calcula utilizando la fórmula de π por radio al cuadrado.
 * @category Matemáticas
 * @package Geometría
 * @author Ronald
 * @version 1.0.0
 * @since 2025-04-28
 * @description Esta función recibe el radio de un círculo y devuelve su área.
 */
function calculateCircleArea(radius: number): number {
    return Math.PI * Math.pow(radius, 2);
}
