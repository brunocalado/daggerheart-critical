/**
 * Critical Configuration Data Model
 * Represents a single critical configuration entry
 */
export class CriticalConfiguration {
    constructor(data = {}) {
        this.id = data.id || foundry.utils.randomID();
        this.name = data.name || "New Critical";
        this.type = data.type || "Player Character";
        this.triggerType = data.triggerType || "Action and Reaction";
        this.userId = data.userId || "all";
        this.adversaryId = data.adversaryId || null;
        this.isDefault = data.isDefault || false;
        this.createdAt = data.createdAt || Date.now();
        this.updatedAt = data.updatedAt || Date.now();
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
            triggerType: this.triggerType,
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
     * Maps trigger type to system.roll.type values
     * @returns {string[]}
     */
    getRollTypes() {
        const mapping = {
            "Action and Reaction": ["action", "reaction"],
            "Only Action": ["action"],
            "Only Reaction": ["reaction"],
            "Fumble": ["fumble"],
            "Level Up": ["levelup"] // Special trigger, not roll-based
        };
        return mapping[this.triggerType] || ["action", "reaction"];
    }
}
