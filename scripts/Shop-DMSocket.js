/**
 * Author: Matheus Clemente (https://github.com/mclemente) & 4535992 (https://github.com/p4535992)
 * Software License: MIT
 */

let socket;
Hooks.once("socketlib.ready", () => {
    socket = socketlib.registerModule("2e-shops");

    // Register setOwnershipForAllPlayers
    socket.register("setOwnershipForAllPlayers", async (actorId) => {
        const actor = game.actors.get(actorId);
        if (!actor) {
            ui.notifications.error(`No actor found for actorId: ${actorId}`);
            return false;
        }

        let updateData = {};
        for (const user of game.users) {
            updateData[`ownership.${user.id}`] = 3; // Set ownership to Owner for all users
        }

        try {
            await actor.update(updateData);
            // Commented out the logging statement
            // ui.notifications.info(`${actor.name} ownership updated to Owner for all players.`);
            return true;
        } catch (err) {
            console.error(err);
            ui.notifications.error(`Failed to update ownership for ${actor.name}`);
            return false;
        }
    });

    // Register setCartItems
    socket.register("setCartItems", async (items) => {
        game.settings.set('2e-shops', 'cartItems', items);
    });
});

async function setOwnershipToDMForEveryone(macro) {
    let updateData = {};
    for (const user of game.users) {
        if (user.isGM) {
            updateData[`ownership.${user.id}`] = 3; // Set ownership to DM
        } else {
            updateData[`ownership.${user.id}`] = 0; // Remove ownership for non-DMs
        }
    }
    await macro.update(updateData).then(updatedMacro => {
    }).catch(err => {
        console.error(`Failed to update ownership for macro ${macro.name}`, err);
    });
}

Hooks.once("init", () => {
    class AdvancedMacro extends CONFIG.Macro.documentClass {
        static metadata = Object.freeze(mergeObject(super.metadata, {
            preserveOnImport: ["_id", "sort", "ownership", "author"]
        }, { inplace: false }));

        canUserExecute(user) {
            if (!this.testUserPermission(user, "LIMITED")) return false;
            return this.type === "script" ? user.can("MACRO_SCRIPT") || (canRunAsGM(this) && !user.isGM) : true;
        }

        async execute(scope = {}, callFromSocket = false) {
            if (!this.canExecute) {
                return ui.notifications.warn(`You do not have permission to execute Macro "${this.name}".`);
            }
            switch (this.type) {
                case "chat":
                    return super.execute(scope);
                case "script": {
                    const runFor = this.getFlag("advanced-macros", "runForSpecificUser");
                    if (callFromSocket || !runFor || runFor === "runAsWorldScript" || !canRunAsGM(this)) {
                        return super.execute(scope);
                    } else if (runFor === "GM") {
                        if (game.users.activeGM?.isSelf) return super.execute(scope);
                        return socket.executeAsGM("executeMacro", this.id, scope);
                    } else if (runFor === "runForEveryone") {
                        return socket.executeForEveryone("executeMacro", this.id, scope);
                    } else if (runFor === "runForEveryoneElse") {
                        return socket.executeForOthers("executeMacro", this.id, scope);
                    } else if (runFor) {
                        return socket.executeForUsers("executeMacro", [runFor], this.id, scope);
                    }
                }
            }
        }
    }

    CONFIG.Macro.documentClass = AdvancedMacro;
});

function canRunAsGM(macro) {
    const author = game.users.get(macro.author?.id);
    const permissions = deepClone(macro.ownership) || {};

    for (const user of game.users.contents) {
        if (user.isGM || user.id === author?.id) delete permissions[user.id];
    }
    const highestPermissionLevel = Math.max(...Object.values(permissions));
    return author?.isGM && highestPermissionLevel < CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
}
