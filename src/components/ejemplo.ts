export class Usuario {
    nombre: string;

    // El nombre del usuario
    getNombre(): string {
        return this.nombre;
    }

    // Establece el nombre del usuario
    setNombre(nuevoNombre: string): void {
        this.nombre = nuevoNombre;
    }

    crearUsuario(nombre: string): void {
        console.log('Usuario creado');
    }

    /** Esto está mal cerrado
     * @param texto texto
     */
    metodoConError(texto: string): void {
        console.log(texto);
    }
}
