export class Usuario {
    nombre: string;

    getNombre(): string {
        return this.nombre;
    }


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
// archivo con error.ts
export function sinDoc() {
    return  true;
