// src/components/ejemplo.ts

/**
 * Clase para representar a un Usuario.
 */
class Usuario {
    /**
     * El nombre del usuario.
     * @type {string}
     */
    nombre: string;

    /**
     * El correo electrónico del usuario.
     * @type {string}
     */
    correo: string;

    /**
     * Constructor para inicializar un usuario.
     * @param nombre El nombre del usuario.
     * @param correo El correo electrónico del usuario.
     */
    constructor(nombre: string, correo: string) {
        this.nombre = nombre;
        this.correo = correo;
    }

    /**
     * Muestra un saludo para el usuario.
     */
    saludar() {
        console.log(`¡Hola, ${this.nombre}!`);
    }

    /**
     * Devuelve el dominio del correo electrónico del usuario.
     */
    obtenerDominioCorreo() {
        return this.correo.split('@')[1];
    }

    // Método sin documentación
    metodoSinDoc() {
        console.log('Este es un método sin documentación.');
    }
}
