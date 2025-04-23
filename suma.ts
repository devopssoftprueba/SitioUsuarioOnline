/**
 * Clase que representa un usuario del sistema.
 */
export class Usuario {
    /**
     * Nombre del usuario.
     */
    private nombre: string;

    /**
     * Crea una nueva instancia de Usuario.
     * @param nombre Nombre del usuario.
     */
    constructor(nombre: string) {
        this.nombre = nombre;
    }

    /**
     * Devuelve el nombre del usuario.
     * @returns El nombre del usuario.
     */
    obtenerNombre(): string {
        return this.nombre;
    }
}
