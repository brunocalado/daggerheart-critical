/**
 * Configuration Validator Service
 * Validates critical configuration data
 */
export class ConfigurationValidator {
    /**
     * Validates name field
     * @param {string} name
     * @returns {string|null} Error message or null if valid
     */
    static validateName(name) {
        if (!name || name.trim() === "") {
            return "Name cannot be empty";
        }
        if (name.length > 30) {
            return "Name cannot exceed 30 characters";
        }
        return null;
    }

    /**
     * Validates type field
     * @param {string} type
     * @returns {string|null} Error message or null if valid
     */
    static validateType(type) {
        if (!["Player Character", "Adversary"].includes(type)) {
            return "Type must be 'Player Character' or 'Adversary'";
        }
        return null;
    }

    /**
     * Validates target field
     * @param {string} target
     * @returns {string|null} Error message or null if valid
     */
    static validateTarget(target) {
        if (!["Action and Reaction", "Only Action", "Only Reaction"].includes(target)) {
            return "Target must be one of: Action and Reaction, Only Action, Only Reaction";
        }
        return null;
    }

    /**
     * Validates Player Character entry
     * @param {Object} config
     * @returns {string|null} Error message or null if valid
     */
    static validatePlayerCharacterEntry(config) {
        if (config.type === "Player Character" && !config.userId) {
            return "Please select a user for Player Character type";
        }
        // "all" is a valid value for userId
        if (config.type === "Player Character" && config.userId && config.userId !== "all") {
            // Validate that the userId exists in the game
            const user = game.users.get(config.userId);
            if (!user) {
                return "Selected user does not exist";
            }
        }
        return null;
    }

    /**
     * Validates Adversary entry
     * @param {Object} config
     * @returns {string|null} Error message or null if valid
     */
    static validateAdversaryEntry(config) {
        // Empty adversaryId is valid - it means "all adversaries"
        // No validation needed for adversary type
        return null;
    }

    /**
     * Validates entire configuration
     * @param {Object} config
     * @returns {string[]} Array of error messages (empty if valid)
     */
    static validateConfiguration(config) {
        const errors = [];

        const nameError = this.validateName(config.name);
        if (nameError) errors.push(nameError);

        const typeError = this.validateType(config.type);
        if (typeError) errors.push(typeError);

        const targetError = this.validateTarget(config.target);
        if (targetError) errors.push(targetError);

        const pcError = this.validatePlayerCharacterEntry(config);
        if (pcError) errors.push(pcError);

        const advError = this.validateAdversaryEntry(config);
        if (advError) errors.push(advError);

        return errors;
    }
}
