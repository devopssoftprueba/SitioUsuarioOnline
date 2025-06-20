/**
 * Archivo de configuración principal para la vista de usuarios en Webix.
 * @author Ronald Pelaez
 * @date 2024-06-10
 * @view datatable
 * @notes Incluye importaciones, vistas, propiedades, eventos y métodos.
 */

/**
 * Importa la librería principal de Webix.
 * @import webix
 */
import webix from "webix";

/**
 * Importa utilidades personalizadas.
 * @import utils
 */
import { fetchUsers, saveUser } from "./utils";

/**
 * Configuración de la vista principal de usuarios.
 * @view datatable
 * @property {string} id Identificador único de la tabla.
 * @property {array} columns Columnas de la tabla.
 * @property {array} data Datos iniciales de la tabla.
 * @event {function} onItemClick Evento al hacer clic en un elemento.
 * @method {function} reloadUsers Recarga los datos de usuarios.
 */
const userTable = {
    view: "datatable",
    id: "userTable",
    columns: [
        { id: "id", header: "ID", width: 50 },
        { id: "name", header: "Nombre", fillspace: true },
        { id: "email", header: "Correo", width: 200 }
    ],
    data: [],
    /**
     * Evento que se dispara al hacer clic en una fila.
     * @event onItemClick
     * @param {string} id ID del elemento clickeado.
     * @param {object} e Evento de clic.
     */
    on: {
        onItemClick: function(id, e) {
            showUserDetails(id);
        }
    }
};

/**
 * Vista de formulario para agregar/editar usuarios.
 * @view form
 * @property {string} id Identificador del formulario.
 * @property {array} elements Elementos del formulario.
 * @event {function} onSubmit Evento al enviar el formulario.
 */
const userForm = {
    view: "form",
    id: "userForm",
    elements: [
        { view: "text", name: "name", label: "Nombre" },
        { view: "text", name: "email", label: "Correo" },
        { view: "button", value: "Guardar", click: saveForm }
    ]
};

/**
 * Metodo para mostrar los detalles de un usuario.
 * @method showUserDetails
 * @param {string} userId ID del usuario a mostrar.
 */
function showUserDetails(userId) {
    // Lógica para mostrar detalles
}

/**
 * Metodo para guardar el formulario de usuario.
 * @method saveForm
 * @returns {void}
 */
function saveForm() {
    const values = $$("userForm").getValues();
    saveUser(values);
}

/**
 * Metodo para recargar los datos de usuarios en la tabla.
 * @method reloadUsers
 * @returns {Promise<void>}
 */
async function reloadUsers() {
    const users = await fetchUsers();
    $$("userTable").clearAll();
    $$("userTable").parse(users);
}

/**
 * Inicialización de la interfaz principal.
 * @method init
 * @returns {void}
 */
function init() {
    webix.ui({
        rows: [
            userTable,
            userForm
        ]
    });
    reloadUsers();
}

// Ejecuta la inicialización al cargar el archivo
init();