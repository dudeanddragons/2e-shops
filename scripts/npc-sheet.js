import { ShopMultipliers } from './shop-multipliers.js';

Hooks.on('renderActorSheet', async (app, html, data) => {
    if (app.actor.type === 'npc') {
        // Add the Shop tab
        const tabs = html.find('.tab-items');
        const newTab = $(`
            <a class="item tab-item" data-tab="shop" data-tooltip="Shop">
                <i class="fas fa-store"></i>
            </a>
        `);
        tabs.append(newTab);

        // Add the content for the Shop tab
        const content = html.find('.sheet-body');
        const newContent = $(`
            <div class="tab shop" data-tab="shop">
                <form id="shop-multipliers-form"></form>
                <div id="npc-currencies"></div>
            </div>
        `);
        content.append(newContent);

        // Render the multipliers form for NPC
        ShopMultipliers.renderMultipliersForm(app.actor, html);

        // Assume we have access to the player actor
        const playerActor = game.user.character; // Modify as necessary to get the player actor

        if (playerActor) {
            // Copy the NPC multipliers to the player actor
            await ShopMultipliers.copyMultipliersFromNPCToPlayer(app.actor, playerActor);
        }

        // Render the NPC currencies
        ShopMultipliers.renderCurrencies(app.actor, html);
    }
});
