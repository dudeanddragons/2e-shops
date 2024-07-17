console.log('shop-multipliers.js is loaded');

export class ShopMultipliers {
    static subtypes = [
        { id: 'Ammunition', label: 'Ammunition' },
        { id: 'Animal', label: 'Animal' },
        { id: 'Armor', label: 'Armor' },
        { id: 'Clothing', label: 'Clothing' },
        { id: 'Container', label: 'Container' },
        { id: 'Daily Food and Lodging', label: 'Food/Lodging' },
        { id: 'Gear', label: 'Gear' },
        { id: 'Gem', label: 'Gem' },
        { id: 'Magic', label: 'Magic' }, // Added Magic subtype
        { id: 'Provisions', label: 'Provisions' },
        { id: 'Service', label: 'Service' },
        { id: 'Tack and Harness', label: 'Tack/Harness' },
        { id: 'Tool', label: 'Tool' },
        { id: 'Transport', label: 'Transport' },
        { id: 'Weapon', label: 'Weapon' }
    ];

    static multipliers = [0, ...Array.from({ length: 100 }, (_, i) => (i + 1) / 10)]; // Values from 0 to 10.0

    static getMultipliers(actor) {
        const defaultMultipliers = {
            buy: {},
            sell: {},
            purchaseLimits: { singlePurchaseLimit: 10 },
            bartering: { barterModifier: 0, barterAttempts: 0, barterCounter: 0 }
        };

        this.subtypes.forEach(subtype => {
            if (!defaultMultipliers.buy[subtype.id]) defaultMultipliers.buy[subtype.id] = 1;
            if (!defaultMultipliers.sell[subtype.id]) defaultMultipliers.sell[subtype.id] = 0.5;
        });

        const multipliers = actor.getFlag('2e-shops', 'shopMultipliers') || defaultMultipliers;
        console.log(`Retrieved Multipliers for ${actor.name} (${actor.type}):`, multipliers);
        return multipliers;
    }

    static async setMultipliers(actor, multipliers) {
        console.log(`Setting Multipliers for ${actor.name} (${actor.type}):`, multipliers);
        await actor.setFlag('2e-shops', 'shopMultipliers', multipliers);
        const setMultipliers = await actor.getFlag('2e-shops', 'shopMultipliers');
        console.log(`Multipliers successfully set for ${actor.name} (${actor.type}):`, setMultipliers);
    }

    static async copyMultipliersFromNPCToPlayer(npcActor, playerActor) {
        const npcMultipliers = this.getMultipliers(npcActor);
        console.log(`Copying Multipliers from NPC ${npcActor.name} to Player ${playerActor.name}:`, npcMultipliers);

        // Ensure the multipliers are deep copied
        const copiedMultipliers = JSON.parse(JSON.stringify(npcMultipliers));

        await this.setMultipliers(playerActor, copiedMultipliers);

        // Verify the copied multipliers
        const verifiedMultipliers = await playerActor.getFlag('2e-shops', 'shopMultipliers');
        console.log(`Copied Multipliers for Player Actor (ID: ${playerActor.id}, Name: ${playerActor.name}):`, verifiedMultipliers);
    }

    static applyBuyMultiplier(actor, item) {
        const multipliers = this.getMultipliers(actor);
        const subtype = item.system.attributes?.subtype || item.type || "Unknown";
        const isMagic = item.system.attributes?.magic || false;
        console.log(`Item subtype for buying by ${actor.name} (${actor.type}): ${subtype}, isMagic: ${isMagic}`);
        
        const multiplier = isMagic ? multipliers.buy['Magic'] : (multipliers.buy[subtype] ?? 1);
        const price = item.system.price?.value ?? item.system.cost?.value ?? 0;
        const result = Math.ceil(price * multiplier);
        console.log(`applyBuyMultiplier: itemID=${item.id}, subtype=${subtype}, price=${price}, multiplier=${multiplier}, result=${result}`);
        return result;
    }

    static applySellMultiplier(actor, item) {
        const multipliers = this.getMultipliers(actor);
        const subtype = item.system.attributes?.subtype || item.type || "Unknown";
        const isMagic = item.system.attributes?.magic || false;
        console.log(`Item subtype for selling by ${actor.name} (${actor.type}): ${subtype}, isMagic: ${isMagic}`);

        const multiplier = isMagic ? multipliers.sell['Magic'] : (multipliers.sell[subtype] ?? 1);
        console.log(`Multiplier for selling subtype ${subtype}: ${multiplier}`);

        if (item.system?.cost) {
            const cost = item.system.cost.value;
            const result = Math.ceil(cost * multiplier);
            console.log(`applySellMultiplier: itemID=${item.id}, subtype=${subtype}, cost=${cost}, multiplier=${multiplier}, result=${result}`);
            return result;
        } else {
            console.error('Item system cost is undefined:', item);
            return 0; // Return 0 to avoid breaking the code execution.
        }
    }

    static async handleMultipliers() {
        const selectedTokens = canvas.tokens.controlled;
        const targetedTokens = Array.from(game.user.targets);

        if (selectedTokens.length !== 1 || targetedTokens.length !== 1) {
            ui.notifications.error("Please select one player token and target one NPC token.");
            return;
        }

        const playerToken = selectedTokens[0];
        const npcToken = targetedTokens[0];

        if (playerToken.document.actor.type !== "character" || npcToken.document.actor.type !== "npc") {
            ui.notifications.error("Selected token must be a player character and targeted token must be an NPC.");
            return;
        }

        const playerActor = playerToken.document.actor;
        const npcActor = npcToken.document.actor;

        await this.copyMultipliersFromNPCToPlayer(npcActor, playerActor);
    }

    static renderMultipliersForm(actor, html) {
        const shopTab = html.find('.tab[data-tab="shop"]');
        if (!shopTab.length) return; // If the shop tab doesn't exist, exit

        const multipliers = this.getMultipliers(actor);
        const tempMultipliers = JSON.parse(JSON.stringify(multipliers)); // Clone the multipliers object

        const buyContent = $(`
            <div class="shop-multipliers-section">
                <h3>Player Purchase Multipliers</h3>
                <div class="form-group" id="buy-multipliers-group">
                    ${ShopMultipliers.subtypes.map(subtype => `
                        <div class="form-item">
                            <label>${subtype.label}</label>
                            <select id="buy-multiplier-${subtype.id.replace(/\s+/g, '-').toLowerCase()}" name="buy-multiplier-${subtype.id}" class="multiplier-select">
                                ${ShopMultipliers.multipliers.map(value => `
                                    <option value="${value}">${value}</option>
                                `).join('')}
                            </select>
                        </div>
                    `).join('')}
                </div>
            </div>
        `);
        
        const sellContent = $(`
            <div class="shop-multipliers-section">
                <h3>Player Selling Multipliers</h3>
                <div class="form-group" id="sell-multipliers-group">
                    ${ShopMultipliers.subtypes.map(subtype => `
                        <div class="form-item">
                            <label>${subtype.label}</label>
                            <select id="sell-multiplier-${subtype.id.replace(/\s+/g, '-').toLowerCase()}" name="sell-multiplier-${subtype.id}" class="multiplier-select">
                                ${ShopMultipliers.multipliers.map(value => `
                                    <option value="${value}">${value}</option>
                                `).join('')}
                            </select>
                        </div>
                    `).join('')}
                </div>
            </div>
        `);
        
        const purchaseLimitsContent = $(`
            <div class="shop-multipliers-section">
                <h3>Purchase Limits</h3>
                <div class="form-group">
                    <div class="form-item">
                        <label for="purchase-limit-single">Single Purchase Limit</label>
                        <input type="number" id="purchase-limit-single" name="purchase-limit-single" min="0" step="0.01">
                    </div>
                </div>
            </div>
        `);
        
        const barteringContent = $(`
            <div class="shop-multipliers-section">
                <h3>Bartering</h3>
                <div class="form-group">
                    <div class="form-item">
                        <label>Barter Modifier</label>
                        <input type="number" id="barter-modifier" name="barter-modifier" min="0" step="0.01">
                    </div>
                    <div class="form-item">
                        <label>Barter Attempts</label>
                        <input type="number" id="barter-attempts" name="barter-attempts" min="0" step="1">
                    </div>
                    <div class="form-item">
                        <label>Barter Counter</label>
                        <input type="number" id="barter-counter" name="barter-counter" min="0" step="1">
                    </div>
                </div>
            </div>
        `);        

        shopTab.append(buyContent, sellContent, purchaseLimitsContent, barteringContent);

        // Event listeners for combo boxes
        ShopMultipliers.subtypes.forEach(subtype => {
            shopTab.find(`#buy-multiplier-${subtype.id.replace(/\s+/g, '-').toLowerCase()}`).change(function () {
                const value = parseFloat($(this).val());
                tempMultipliers.buy[subtype.id] = value;
                console.log(`Updated Buy Multiplier for ${subtype.id}: ${value}`);
            });

            shopTab.find(`#sell-multiplier-${subtype.id.replace(/\s+/g, '-').toLowerCase()}`).change(function () {
                const value = parseFloat($(this).val());
                tempMultipliers.sell[subtype.id] = value;
                console.log(`Updated Sell Multiplier for ${subtype.id}: ${value}`);
            });
        });

        // Event listeners for purchase limits
        shopTab.find('#purchase-limit-single').change(function () {
            const value = parseFloat($(this).val());
            if (!tempMultipliers.purchaseLimits) tempMultipliers.purchaseLimits = {};
            tempMultipliers.purchaseLimits.singlePurchaseLimit = value;
            console.log('Updated Purchase Limits:', tempMultipliers.purchaseLimits);
        });

        // Event listeners for bartering
        shopTab.find('#barter-modifier').change(function () {
            const value = parseFloat($(this).val());
            if (!tempMultipliers.bartering) tempMultipliers.bartering = {};
            tempMultipliers.bartering.barterModifier = value;
            console.log('Updated Bartering:', tempMultipliers.bartering);
        });

        shopTab.find('#barter-attempts').change(function () {
            const value = parseInt($(this).val());
            if (!tempMultipliers.bartering) tempMultipliers.bartering = {};
            tempMultipliers.bartering.barterAttempts = value;
            console.log('Updated Bartering:', tempMultipliers.bartering);
        });

        shopTab.find('#barter-counter').change(function () {
            const value = parseInt($(this).val());
            if (!tempMultipliers.bartering) tempMultipliers.bartering = {};
            tempMultipliers.bartering.barterCounter = value;
            console.log('Updated Bartering:', tempMultipliers.bartering);
        });

        // Set default values
        ShopMultipliers.subtypes.forEach(subtype => {
            shopTab.find(`#buy-multiplier-${subtype.id.replace(/\s+/g, '-').toLowerCase()}`).val(tempMultipliers.buy[subtype.id] ?? 1);
            shopTab.find(`#sell-multiplier-${subtype.id.replace(/\s+/g, '-').toLowerCase()}`).val(tempMultipliers.sell[subtype.id] ?? 1);
        });
        shopTab.find('#purchase-limit-single').val(tempMultipliers.purchaseLimits.singlePurchaseLimit ?? 0);
        shopTab.find('#barter-modifier').val(tempMultipliers.bartering.barterModifier ?? 0);
        shopTab.find('#barter-attempts').val(tempMultipliers.bartering.barterAttempts ?? 0);
        shopTab.find('#barter-counter').val(tempMultipliers.bartering.barterCounter ?? 0);

        // Populate currency fields
        const npcCurrency = actor.system.currency;
        shopTab.find('#npc-cp').text(npcCurrency.cp || 0);
        shopTab.find('#npc-sp').text(npcCurrency.sp || 0);
        shopTab.find('#npc-gp').text(npcCurrency.gp || 0);
        shopTab.find('#npc-pp').text(npcCurrency.pp || 0);
        shopTab.find('#npc-ep').text(npcCurrency.ep || 0);

        // Save the multipliers when the sheet is closed
        Hooks.once('closeActorSheet', async (app, html) => {
            console.log(`Saving multipliers for ${actor.name} (${actor.type}) on close`);
            await ShopMultipliers.setMultipliers(actor, tempMultipliers);
        });

        // Log the multipliers for debugging
        console.log('Rendered Multipliers Form with Actor Multipliers:', multipliers);
    }
}

// To be triggered by a macro or a button
ShopMultipliers.handleMultipliers();
