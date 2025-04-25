/**
 * Clase que representa un usuario del sistema.
 */
export class Usuario {
    /**
     * Nombre del usuario.
     */
    private nombre: string;

    /**
     *
     *
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

function hola() {
    return 'mundo';
}


/**
 * Función para crear un nuevo producto.
 *
 * @param nombre El nombre del producto.
 * @param precio El precio del producto.
 * @returns Un objeto producto con el nombre y precio proporcionados.
 */
function crearProducto(nombre: string, precio: number): Producto {
    return {
        nombre: nombre,
        precio: precio
    };


}

/**
 * Función para crear un nuevo producto.
 *
 * @param nombre El nombre del producto.
 * @param precio El precio del producto.
 * @returns Un objeto producto con el nombre y precio proporcionados.
 */
function funcionsindoc(nombre: string, precio: number): Producto {
    return {
        nombre: nombre,
        precio: precio
    };


}


