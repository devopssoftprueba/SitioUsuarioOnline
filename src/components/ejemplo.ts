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

    /**
     * Sets the user's name.
     *
     * @param name - The new name to assign to the user.
     * @returns void
     */
    establecerNombre(name: string): void {
        this.nombre = name;
    }


    /**
     * Returns a greeting message for the user.
     *
     * @returns A personalized greeting string.
     */
    saludar(): string {
        return `Hola, ${this.nombre}!`;
    }


    obtenerDominioCorreo(): string {
        const partesCorreo = this.correo.split('@');
        return partesCorreo.length > 1 ? partesCorreo[1] : '';
    }

}
