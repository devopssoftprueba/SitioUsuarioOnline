/**
 * ExampleClass demonstrates basic structure with a documented method and property.
 *
 * @category Example
 * @package example
 * @author Ronald
 * @version 1.0.0
 * @since 2025-04-28
 * @description This class includes a sample method and a property to illustrate proper documentation using TSDoc.
 */
class ExampleClass {
    /**
     * Returns a formatted string with both input parameters.
     *
     * @param param12 - A string parameter to be displayed in the result.
     * @param param2 - A numeric parameter to be displayed in the result.
     * @returns A formatted string including both parameters.
     * @category Example
     * @package example
     * @author Ronald
     * @version 1.0.0
     * @since 2025-04-28
     * @description This method returns a formatted string using the provided parameters.
     */
    exampleMethod(param12: string, param2: number): string {
        return `Param12: ${param12}, Param2: ${param2}`;
    }

    /**
     * Example property that stores a message.
     *
     * @var {string} exampleProperty - pongo este mensaje en español.
     */
    exampleProperty: string = 'Hello World';
}

/**
 * Calculates the area of a circle using the radius provided.
 *
 * @param radius - The radius of the circle.
 * @returns pongo se cambia a español.
 * @category Math
 * @package Geometry
 * @author Ronald
 * @version 1.0.0
 * @since 2025-04-28
 * @description This function takes the radius of a circle and returns its area.
 */
function calculateCircleArea(radius: number): number {
    return Math.PI * Math.pow(radius, 2);
}
