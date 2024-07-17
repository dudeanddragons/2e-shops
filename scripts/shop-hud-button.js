console.log('Initializing 2e-shops module...');

async function updateSubtypes(actor) {
    console.log(`Updating subtypes for actor ${actor.name}`);
    await window.updateActorSubtypes(actor);
}

async function setOwnershipForPlayer(actorId, userId, ownershipLevel) {
    const actor = game.actors.get(actorId);
    if (!actor) {
        ui.notifications.error(`No actor found for actorId: ${actorId}`);
        return false;
    }

    let updateData = {};
    updateData[`ownership.${userId}`] = ownershipLevel;

    try {
        await actor.update(updateData);
        console.log(`${actor.name} ownership updated to ${ownershipLevel} for user ${userId}.`);
        return true;
    } catch (err) {
        console.error(err);
        ui.notifications.error(`Failed to update ownership for ${actor.name}`);
        return false;
    }
}

async function openShop(selectedActorId, targetedActorId) {
    try {
        console.log('openShop called with:', selectedActorId, targetedActorId);
        const selectedActor = game.actors.get(selectedActorId);
        const targetedActor = game.actors.get(targetedActorId);

        if (!selectedActor || selectedActor.type !== 'character') {
            console.warn("Selected actor is not found or not a player character.");
            ui.notifications.warn("Please select a player character.");
            return;
        }

        if (!targetedActor || targetedActor.type !== 'npc') {
            console.warn("Targeted actor is not found or not an NPC.");
            ui.notifications.warn("Please target an NPC to open the shop.");
            return;
        }

        const shopModule = game.modules.get('2e-shops');
        if (shopModule && shopModule.api && typeof shopModule.api.openBuyAndSell === 'function') {
            await updateSubtypes(selectedActor);
            await updateSubtypes(targetedActor);
            await setOwnershipForPlayer(targetedActorId, game.user.id, 3);
            shopModule.api.openBuyAndSell(selectedActor, targetedActor);
        } else {
            console.error('Failed to open shop: openBuyAndSell function not found in 2e-shops module.');
            ui.notifications.error('Failed to open shop: Function not found.');
        }
    } catch (error) {
        console.error('Error occurred in openShop:', error);
        ui.notifications.error('An error occurred while trying to open the shop.');
    }
}

Hooks.once("socketlib.ready", () => {
    console.log('Socketlib is ready');
    const socket = socketlib.registerModule("2e-shops");

    socket.register("setNpcPermissionsToOwned", async (targetedActorId, userId) => {
        const result = await setOwnershipForPlayer(targetedActorId, userId, 3);
        return result;
    });

    Hooks.on('renderARSCombatHUD', (hud, html, data) => {
        console.log('Rendering ARSCombatHUD...');
        console.log('HUD:', hud);
        console.log('HTML:', html);
        console.log('Data:', data);

        const buttonHtml = `
            <li class="mini-action item flexrow weapon-combat with-background-image open-shop-button" title="Open Shop">
                <img src="icons/environment/settlement/market-stall.webp" width="36" height="36">
                <span style="font-size: 10px; display: block; text-align: center;">Shop</span>
            </li>
        `;

        const button = $(buttonHtml);

        button.on('click', async () => {
            console.log('Open Shop button clicked...');

            try {
                if (canvas.tokens.controlled.length === 0) {
                    ui.notifications.warn("No token selected!");
                    return;
                }

                const selectedActor = canvas.tokens.controlled[0].actor;
                const targetedToken = game.user.targets.first();
                if (!selectedActor || !targetedToken) {
                    ui.notifications.warn("Please select a player character and target an NPC.");
                    return;
                }

                const targetedActor = targetedToken.actor;
                console.log('Selected actor:', selectedActor);
                console.log('Targeted actor:', targetedActor);

                if (!game.user.isGM) {
                    console.log('Emitting socket event to GM for setting permissions...');
                    if (typeof socket !== 'undefined' && socket) {
                        socket.executeAsGM('setNpcPermissionsToOwned', targetedActor.id, game.user.id).then(async (result) => {
                            if (result) {
                                console.log('Permission set by GM, now opening shop for player...');
                                await openShop(selectedActor.id, targetedActor.id);
                            } else {
                                console.error('Failed to set permissions via GM');
                                ui.notifications.error('Failed to set permissions via GM');
                            }
                        });
                    } else {
                        console.error('Socket not initialized');
                    }
                } else {
                    await setOwnershipForPlayer(targetedActor.id, game.user.id, 3);
                    await openShop(selectedActor.id, targetedActor.id);
                }
            } catch (error) {
                console.error('Error occurred while handling button click:', error);
                ui.notifications.error('An error occurred while trying to open the shop.');
            }
        });

        const targetElement = html.find('.mini-actions-buttons');
        if (targetElement.length > 0) {
            targetElement.prepend(button);
        } else {
            console.error('.mini-actions-buttons element not found');
        }
    });
});

async function resetOwnershipForPlayer(actorId, userId) {
    return setOwnershipForPlayer(actorId, userId, 0);
}

Hooks.on('closeDialog', async (dialog) => {
    if (dialog.title.includes('Shop:')) {
        const targetedActorId = dialog.data?.npcActorId;
        if (targetedActorId) {
            await resetOwnershipForPlayer(targetedActorId, game.user.id);
        }
    }
});

async function setNpcPermissionsToOwned(actorId, userId) {
    return setOwnershipForPlayer(actorId, userId, 3);
}

Hooks.once('init', () => {
    console.log('shop-hud-button.js initialization hook');
});

Hooks.once('ready', () => {
    if (game.user.isGM) {
        console.log('GM ready to receive socket events');
    }
});
