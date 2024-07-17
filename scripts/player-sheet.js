import { ShopMultipliers } from './shop-multipliers.js';

Hooks.on('renderActorSheet', async (app, html, data) => {
    if (app.actor.type === 'character') {
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
                <div id="player-currencies"></div>
            </div>
        `);
        content.append(newContent);

        // Render the multipliers form for Player
        ShopMultipliers.renderMultipliersForm(app.actor, html);

        // Fetch the NPC multipliers and set them for the player
        await ShopMultipliers.copyMultipliersFromStoredToPlayer(app.actor);

        // Render the Player currencies
        ShopMultipliers.renderCurrencies(app.actor, html);
    }
});
