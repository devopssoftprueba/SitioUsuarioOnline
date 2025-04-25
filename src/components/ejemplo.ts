/**
 * Clase que representa a un Usuario en el sistema.
 *
 * Esta clase contiene información básica sobre un usuario, como su nombre y correo electrónico,
 * y ofrece métodos para interactuar con estos datos.
 *
 * @category Modelo
 * @package SistemaUsuarios
 * @author Ronald
 * @version 1.0
 * @since 2025-04-25
 */
class Usuario {
    /**
     * Nombre del usuario.
     *
     * @var {string}
     */
    nombre: string;

    /**
     * Correo electrónico del usuario.
     *
     * @var {string}
     */
    correo: string;

    /**
     * Constructor de la clase Usuario.
     *
     * @param {string} nombre - El nombre del usuario.
     * @param {string} correo - El correo electrónico del usuario.
     */
    constructor(nombre: string, correo: string) {
        this.nombre = nombre;
        this.correo = correo;
    }

    /**
     * Metodo para saludar al usuario.
     *
     * @returns {string} Un saludo dirigido al usuario.
     */
    saludar(): string {
        return `Hola, ${this.nombre}!`;
    }

    /**
     * Metodo para obtener el dominio del correo del usuario.
     *
     * @returns {string} El dominio del correo electrónico.
     */
    obtenerDominioCorreo(): string {
        const partesCorreo = this.correo.split('@');
        return partesCorreo.length > 1 ? partesCorreo[1] : '';
    }
}

// Ejemplo de uso
const usuario = new Usuario("Juan Pérez", "juan.perez@example.com");
console.log(usuario.saludar());
console.log(usuario.obtenerDominioCorreo());
