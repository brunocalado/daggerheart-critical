/**
 * Critical Configuration Data Model
 * Represents a single critical configuration entry
 */
export class CriticalConfiguration {
    constructor(data = {}) {
        this.id = data.id || foundry.utils.randomID();
        this.name = data.name || "New Critical";
        this.type = data.type || "Player Character";
        this.target = data.target || "Action and Reaction";
        this.userId = data.userId || null;
        this.adversaryId = data.adversaryId || null;
        this.isDefault = data.isDefault || false;
        this.createdAt = data.createdAt || Date.now();
        this.updatedAt = data.updatedAt || Date.now();
    }

    /**
     * Validates the configuration
     * @returns {string[]} Array of error messages (empty if valid)
     */
    validate() {
        const errors = [];
        
        if (!this.name || this.name.trim() === "") {
            errors.push("Name cannot be empty");
        }
        
        if (this.name && this.name.length > 30) {
            errors.push("Name cannot exceed 30 characters");
        }
        
        if (!["Player Character", "Adversary"].includes(this.type)) {
            errors.push("Type must be 'Player Character' or 'Adversary'");
        }
        
        if (!["Action and Reaction", "Only Action", "Only Reaction"].includes(this.target)) {
            errors.push("Target must be one of: Action and Reaction, Only Action, Only Reaction");
        }
        
        return errors;
    }

    /**
     * Converts to JSON-serializable object
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            target: this.target,
            userId: this.userId,
            adversaryId: this.adversaryId,
            isDefault: this.isDefault,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    /**
     * Creates instance from JSON data
     * @param {Object} data
     * @returns {CriticalConfiguration}
     */
    static fromJSON(data) {
        return new CriticalConfiguration(data);
    }

    /**
     * Maps target type to system.roll.type values
     * @returns {string[]}
     */
    getRollTypes() {
        const mapping = {
            "Action and Reaction": ["action", "reaction"],
            "Only Action": ["action"],
            "Only Reaction": ["reaction"]
        };
        return mapping[this.target] || ["action", "reaction"];
    }
}
