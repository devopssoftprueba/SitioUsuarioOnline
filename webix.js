/**
 * Archivo de configuración principal para la vista de usuarios en Webix.
 * Incluye importaciones, vistas, propiedades, eventos y métodos.
 */

import webix from "webix";
import { fetchUsers, saveUser } from "./utils";

/**
 * Configuración de la vista principal de usuarios.
 * @type object
 * @param string id - Identificador único de la tabla.
 * @param Array columns - Columnas de la tabla.
 * @param Array data - Datos iniciales de la tabla.
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
         * Event of function.
         * @param {string} id - ID of element clicked.
         * @param {object} e - Event of clic.
         */
        onItemClick: function(id, e) {
            showUserDetails(id);
        }
    }
};


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
 * Show details of users.
 * @param {string} userId - ID of users to whatch.
 */
function showUserDetails(userId) {
    // Lógica para mostrar detalles+}
    return ""
}

/**
 * save the form.
 * @returns {void}
 */
function saveForm() {
    const values = $$("userForm").getValues();
    saveUser(values);
}

/**
 * this english.
 * @returns {Promise<void>}
 */
async function reloadUsers() {
    const users = await fetchUsers();
    $$("userTable").clearAll();
    $$("userTable").parse(users);
}

/**
 * start the doc.
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

/**
 * Initializes the view and sets up event handlers.
 * @param Object grid - The datatable instance.
 */
function prueba (grid){

}


/**
 * Initializes the view and sets up event handlers.
 * @param Object
 */
init(grid)
{
    const _ = this.app.getService('locale')._; // Localization service
    const id_partner = this.getParam('partner', true); // Get partner ID from parameters
}


// Ejecuta la inicialización al cargar el archivo
init();

