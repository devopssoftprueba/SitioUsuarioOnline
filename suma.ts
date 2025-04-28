
class ExampleClass {
    /**
     * Metodo que toma dos parámetros y devuelve un string con ambos valores.
     *
     * @param param1 - El primer parámetro de tipo string.
     * @param param2 - El segundo parámetro de tipo número.
     * @returns Un string que combina ambos parámetros.
     * @description Este metodo toma dos parámetros y devuelve una cadena que los combina.
     */
    exampleMethod(param1: string, param2: number): string {
        return `Param1: ${param1}, Param2: ${param2}`;
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
    exampleProperty: string = 'Hello World';
}
