/**
 * Archivo de configuración principal para la vista de usuarios en Webix.
 * Incluye importaciones, vistas, propiedades, eventos y métodos.
 */

import webix from "webix";
import { fetchUsers, saveUser } from "./utils";

/**
 * Configuración de la vista principal de usuarios.
 * @type object
 * @property string id - Identificador único de la tabla.
 * @property Array columns - Columnas de la tabla.
 * @property Array data - Datos iniciales de la tabla.
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
    on: {
        /**
         * Evento que se dispara al hacer clic en una fila.
         * @param {string} id - ID del elemento clickeado.
         * @param {object} e - Evento de clic.
         */
        onItemClick: function(id, e) {
            showUserDetails(id);
        }
    }
};

/**
 * Vista de formulario para agregar/editar usuarios.
 * @type {object}
 * @property {string} id - Identificador del formulario.
 * @property {Array} elements - Elementos del formulario.
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
 * Muestra los detalles de un usuario.
 * @param {string} userId - ID del usuario a mostrar.
 */
function showUserDetails(userId) {
    // Lógica para mostrar detalles
}

/**
 * Guarda el formulario de usuario.
 * @returns {void}
 */
function saveForm() {
    const values = $$("userForm").getValues();
    saveUser(values);
}

/**
 * Recarga los datos de usuarios en la tabla.
 * @returns {Promise<void>}
 */
async function reloadUsers() {
    const users = await fetchUsers();
    $$("userTable").clearAll();
    $$("userTable").parse(users);
}

/**
 * Inicializa la interfaz principal.
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