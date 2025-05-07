/**
 * Class representing a user in the system.
 *
 * @description This class stores basic user information such as name and email,
 * and provides methods to interact with that data.
 *
 * @category Model
 * @package UserSystem
 * @author Ronald
 * @version 1.0
 * @since 2025-04-25
 */
class Usuario {
    /** The user's name. */
    nombre: string;

    /** The user's email address. */
    correo: string;

    /**
     * Creates an instance of Usuario.
     *
     * @param nombre - The user's name.
     * @param correo - The user's email address.
     */
    constructor(nombre: string, correo: string) {
        this.nombre = nombre;
        this.correo = correo;
    }

    /**
     * Returns a greeting for the user.
     *
     * @returns A greeting string with the user's name.
     */
    saludar(): string {
        return `Hola, ${this.nombre}!`;
    }

    /**
     * cambio esto al español
     *
     * @returns cambio esto al español.
     */
    obtenerDominioCorreo(): string {
        const partesCorreo = this.correo.split('@');
        return partesCorreo.length > 1 ? partesCorreo[1] : '';
    }
}
