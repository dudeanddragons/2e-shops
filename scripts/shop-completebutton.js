import { getCartItems, setCartItems, updateCartUI } from './shop-cartbutton.js';
import { calculateCopperBase, payCopperBase, giveCurrency } from './currency-utils.js';
import { ShopMultipliers } from './shop-multipliers.js';

const currencyBaseExchange = {
    pp: 500,
    gp: 100,
    ep: 50,
    sp: 10,
    cp: 1
};

const SUBTYPES = {
    INN: 'Inn',
    FOOD: 'Food',
    DAILY_FOOD: 'Daily Food and Lodging',
    SERVICES: 'Service'
};

async function findCurrencyItems() {
    const currencyNames = ["Platinum Coins", "Gold Coins", "Electrum Coins", "Silver Coins", "Copper Coins"];
    const compendiums = game.packs.filter(p => p.documentName === "Item");
    let currencyItems = [];

    console.log('Searching compendiums for currency items...');

    for (const compendium of compendiums) {
        const content = await compendium.getDocuments();
        console.log(`Checking compendium: ${compendium.metadata.label}, found ${content.length} items.`);
        const items = content.filter(item => item.type === "currency" && currencyNames.includes(item.name));
        console.log(`Found ${items.length} currency items in ${compendium.metadata.label}`);
        currencyItems = currencyItems.concat(items);
    }

    if (currencyItems.length === 0) {
        ui.notifications.warn("No specified currency items found.");
    }

    console.log('Currency items found:', currencyItems);
    return currencyItems;
}

async function setOwnershipForAllPlayers(actorId, ownershipLevel) {
    const actor = game.actors.get(actorId);
    if (!actor) {
        ui.notifications.error(`No actor found for actorId: ${actorId}`);
        return false;
    }

    let updateData = {};
    for (const user of game.users) {
        updateData[`ownership.${user.id}`] = ownershipLevel; // Set ownership level for all users
    }

    try {
        await actor.update(updateData);
        console.log(`${actor.name} ownership updated to ${ownershipLevel} for all players.`);
        return true;
    } catch (err) {
        console.error(`Failed to update ownership for ${actor.name}:`, err);
        ui.notifications.error(`Failed to update ownership for ${actor.name}`);
        return false;
    }
}

async function setOwnershipForPlayer(actorId, userId, ownershipLevel) {
    const actor = game.actors.get(actorId);
    if (!actor) {
        ui.notifications.error(`No actor found for actorId: ${actorId}`);
        return false;
    }

    let updateData = {};
    updateData[`ownership.${userId}`] = ownershipLevel; // Set ownership level for the specific user

    try {
        await actor.update(updateData);
        console.log(`${actor.name} ownership updated to ${ownershipLevel} for user ${userId}.`);
        return true;
    } catch (err) {
        console.error(`Failed to update ownership for ${actor.name}:`, err);
        ui.notifications.error(`Failed to update ownership for ${actor.name}`);
        return false;
    }
}

function logItemAdded(item, actor) {
    console.log(`Item added: ${item.name} (ID: ${item.id}) to actor: ${actor.name} (ID: ${actor.id})`);
}

function monitorLogsForOwnershipChange(npcActor, playerActor) {
    const originalLog = console.log;
    let ownershipChangeScheduled = false;

    console.log = async function (...args) {
        originalLog.apply(console, args);

        if (args[0] && typeof args[0] === 'string' && args[0].includes('Item added') && !ownershipChangeScheduled) {
            ownershipChangeScheduled = true;

            console.log("Ownership change scheduled after detecting item addition log.");

            // Schedule the ownership change to run after the current stack
            setTimeout(async () => {
                console.log("Executing ownership change...");
                await setOwnershipForAllPlayers(npcActor.id, 0);
                await setOwnershipForPlayer(npcActor.id, playerActor.id, 0);
                console.log("Ownership updated to none for all players and the selected player.");
                console.log = originalLog; // Restore the original console.log
            }, 0);
        }
    };
}

export async function completeTransaction(html, isSellMode, playerActor, npcActor) {
    console.log('Completing transaction...');

    // Ensure html is a DOM element
    if (html instanceof jQuery) {
        html = html[0];
    }

    // Find currency items in all loaded compendiums
    const currencyItems = await findCurrencyItems();

    // Get cart items and calculate total cost in copper
    const cartItems = getCartItems();
    console.log('Cart items:', cartItems);
    let totalCostInCopper = 0;

    try {
        if (isSellMode) {
            for (const cartItem of cartItems) {
                console.log(`Cart item details: ${cartItem.id}, ${cartItem.name}, Quantity: ${cartItem.quantity}`);

                const playerItem = playerActor.items.get(cartItem.id);
                if (!playerItem) {
                    console.warn(`Item ${cartItem.id} not found in player's inventory`);
                    continue;
                }

                const npcItem = npcActor.items.get(cartItem.id);
                console.log(`Player inventory before transaction for item ${cartItem.id}, ${cartItem.name}: ${playerItem?.system.quantity}`);
                console.log(`NPC inventory before transaction for item ${cartItem.id}, ${cartItem.name}: ${npcItem?.system.quantity}`);

                const remainingQuantity = playerItem.system.quantity - cartItem.quantity;
                console.log(`Deducting from player inventory: ${cartItem.id}, ${cartItem.name}, Quantity: ${cartItem.quantity}`);
                if (remainingQuantity > 0) {
                    await playerItem.update({ 'system.quantity': remainingQuantity });
                } else {
                    await playerActor.deleteEmbeddedDocuments('Item', [cartItem.id]);
                }

                if (npcItem) {
                    const newQuantity = npcItem.system.quantity + cartItem.quantity;
                    console.log(`Updated quantity in NPC inventory: ${newQuantity}`);
                    await npcItem.update({ 'system.quantity': newQuantity });
                } else {
                    // Clone the item data from player to NPC
                    const clonedItemData = foundry.utils.deepClone(playerItem.toObject());
                    clonedItemData.system.quantity = cartItem.quantity;
                    console.log(`Cloning item data to NPC: ${JSON.stringify(clonedItemData)}`);
                    const createdItems = await npcActor.createEmbeddedDocuments('Item', [clonedItemData]);
                    createdItems.forEach(item => logItemAdded(item, npcActor));
                }
            }
        } else {
            for (const cartItem of cartItems) {
                totalCostInCopper += convertToCopper(cartItem.costValue, cartItem.costCurrency) * cartItem.quantity;
            }
            console.log(`Total cost in copper: ${totalCostInCopper}`);

            const playerCurrency = getPlayerCurrency(playerActor);
            console.log(`Player's current currency: ${JSON.stringify(playerCurrency)}`);

            const { canBuy, costBase } = calculateCopperBase(playerCurrency, totalCostInCopper, 'cp');
            console.log(`Can buy: ${canBuy}, Cost in copper: ${costBase}`);

            if (canBuy) {
                for (const cartItem of cartItems) {
                    if (cartItem.subtype === SUBTYPES.DAILY_FOOD || cartItem.subtype === SUBTYPES.INN || cartItem.subtype === SUBTYPES.FOOD || cartItem.subtype === SUBTYPES.SERVICES) {
                        // Deduct cost from playerActor without transferring item or changing quantity
                        console.log(`Processing non-transferable item: ${cartItem.name}`);
                        // Deduct the cost but do not add to player inventory or remove from NPC inventory
                    } else {
                        const npcItem = npcActor.items.get(cartItem.id);
                        if (npcItem) {
                            console.log(`Updating item ${cartItem.id} from NPC inventory`);
                            const newQuantity = npcItem.system.quantity - cartItem.quantity;
                            console.log(`Updated quantity in NPC inventory: ${newQuantity}`);
                            if (newQuantity > 0) {
                                await npcItem.update({ 'system.quantity': newQuantity });
                            } else {
                                await npcActor.deleteEmbeddedDocuments('Item', [cartItem.id]);
                            }

                            // Check if the item already exists in the player's inventory
                            let clonedItem = playerActor.items.get(cartItem.id);
                            if (clonedItem) {
                                // Update the quantity on the existing item to match the cart item
                                console.log(`Updating existing item quantity to match cart item quantity: ${cartItem.quantity}`);
                                await clonedItem.update({ 'system.quantity': clonedItem.system.quantity + cartItem.quantity });
                            } else {
                                // Clone the item data
                                const clonedItemData = foundry.utils.deepClone(npcItem.toObject());
                                console.log(`Cloning item data: Original: ${JSON.stringify(npcItem)}, Cloned: ${JSON.stringify(clonedItemData)}`);

                                // Update the quantity on the cloned item to match the cart item
                                clonedItemData.system.quantity = cartItem.quantity;
                                console.log(`Updating cloned item quantity to match cart item: ${cartItem.quantity}`);

                                // Add the cloned item with the updated quantity to the player's inventory
                                console.log(`Adding item to player inventory: ${JSON.stringify(clonedItemData)}`);
                                const createdItems = await playerActor.createEmbeddedDocuments('Item', [clonedItemData]);
                                createdItems.forEach(item => logItemAdded(item, playerActor));
                            }
                        } else {
                            console.warn(`Item ${cartItem.id} not found in NPC inventory`);
                        }
                    }
                }
                const paymentResult = await payCopperBase(playerActor, costBase, 'cp');
                console.log(`Payment result: ${JSON.stringify(paymentResult)}`);
                ui.notifications.info('Transaction successful: Items bought from NPC.');
            } else {
                ui.notifications.warn("You don't have enough currency for this transaction!");
                return;
            }
        }

        // Clear the cart and update the UI
        setCartItems([]);
        updateCartUI(html);

        // Monitor logs for the specific message before changing ownership
        monitorLogsForOwnershipChange(npcActor, playerActor);

        // Close the shop after the transaction
        closeShop(html);

    } catch (error) {
        console.error('Error during transaction:', error);
        ui.notifications.error('An error occurred during the transaction.');
    }
}

function closeShop(html) {
    console.log('Closing shop...');
    const app = ui.windows[Object.keys(ui.windows).find(key => ui.windows[key].element[0].contains(html))];
    if (app) {
        app.close();
    }
}

async function giveCurrencyFromCompendium(actor, copperBaseGiven, currencyItems) {
    const currencies = Object.keys(currencyBaseExchange);
    const change = {
        cp: 0,
        sp: 0,
        ep: 0,
        gp: 0,
        pp: 0,
    };
    let remainingChange = copperBaseGiven;
    const newCurrencyItems = [];

    console.log(`Distributing ${copperBaseGiven} copper among currencies...`);

    for (const currencyOrder of currencies) {
        const coinValue = currencyBaseExchange[currencyOrder];
        let count = Math.floor(remainingChange / coinValue);
        if (count > 0) {
            remainingChange -= count * coinValue;

            const currencyItem = currencyItems.find(item => item.system?.cost?.currency?.toLowerCase() === currencyOrder);
            if (!currencyItem) {
                console.warn(`No currency item found for ${currencyOrder}`);
                continue;
            }

            const coinItem = actor.items.find(coinItem => coinItem.name === currencyItem.name);
            if (coinItem) {
                const quantity = parseInt(coinItem.system.quantity) || 0;
                const newQuantity = quantity + count;
                await coinItem.update({ 'system.quantity': newQuantity });
                console.log(`Updated existing currency item: ${JSON.stringify({ id: coinItem.id, newQuantity })}`);
            } else {
                const newItemData = {
                    name: currencyItem.name,
                    type: 'currency',
                    img: currencyItem.img,
                    system: {
                        quantity: count,
                        cost: {
                            currency: currencyOrder,
                        },
                    },
                };
                newCurrencyItems.push(newItemData);
                console.log(`Adding new currency item: ${JSON.stringify(newItemData)}`);
            }
        }
    }

    if (newCurrencyItems.length > 0) {
        console.log('Creating new currency items:', newCurrencyItems);
        const createdItems = await actor.createEmbeddedDocuments('Item', newCurrencyItems, {
            hideChanges: true,
        });
        console.log(`Created new currency items: ${JSON.stringify(createdItems)}`);
    }

    return { ...change };
}

function convertToCopper(amount, currency) {
    switch (currency.toLowerCase()) {
        case 'pp': return amount * 500;
        case 'gp': return amount * 100;
        case 'ep': return amount * 50;
        case 'sp': return amount * 10;
        case 'cp': return amount;
        default: return amount;
    }
}

function getPlayerCurrency(actor) {
    const currencyItems = actor.items.filter(item => item.type === "currency");
    const currencyCounts = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };

    currencyItems.forEach(item => {
        const quantity = parseInt(item.system.quantity) || 0;
        const currencyType = item.name.toLowerCase().includes("platinum") ? "pp" :
                            item.name.toLowerCase().includes("gold") ? "gp" :
                            item.name.toLowerCase().includes("electrum") ? "ep" :
                            item.name.toLowerCase().includes("silver") ? "sp" :
                            item.name.toLowerCase().includes("copper") ? "cp" : "cp";
        if (currencyCounts.hasOwnProperty(currencyType)) {
            currencyCounts[currencyType] += quantity;
        }
    });

    return currencyCounts;
}
