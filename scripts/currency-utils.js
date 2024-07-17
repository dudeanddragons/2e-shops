console.log('currency-utils.js is loaded');

const currencyBaseExchange = {
    pp: 500,
    gp: 100,
    ep: 50,
    sp: 10,
    cp: 1
};

/**
 * Calculate the total copper base value from the available currency.
 *
 * @param {Object} availableCurrency - The available currency of the actor.
 * @returns {number} - The total copper base value.
 */
function getCurrentCPTotal(availableCurrency) {
    let totalAvailable = 0;
    for (let currency in availableCurrency) {
        totalAvailable += availableCurrency[currency] * currencyBaseExchange[currency];
    }

    return totalAvailable;
}

/**
 * Calculate the copper base value for the cost and the total available currency.
 *
 * @param {Object} availableCurrency - The available currency of the actor.
 * @param {number} costAmount - The cost amount.
 * @param {string} costCurrency - The currency type of the cost.
 * @returns {Object} - An object containing total available, cost base, currency type, and if the purchase can be made.
 */
export function calculateCopperBase(availableCurrency, costAmount, costCurrency) {
    let costInBaseValue = costAmount * currencyBaseExchange[costCurrency];

    let totalAvailable = 0;
    for (let currency in availableCurrency) {
        totalAvailable += availableCurrency[currency] * currencyBaseExchange[currency];
    }

    return {
        available: totalAvailable,
        costBase: costInBaseValue,
        currencyType: costCurrency,
        canBuy: totalAvailable >= costInBaseValue,
    };
}

/**
 * Add currency to actor's inventory.
 *
 * @param {Object} actor - The actor to whom the currency will be added.
 * @param {string} currencyType - The type of currency (e.g., 'pp', 'gp').
 * @param {number} quantity - The quantity of currency to add.
 */
export async function addCurrencyToActor(actor, currencyType, quantity) {
    const currencyNameMap = {
        pp: 'Platinum Coins',
        gp: 'Gold Coins',
        ep: 'Electrum Coins',
        sp: 'Silver Coins',
        cp: 'Copper Coins'
    };

    const currencyImgMap = {
        pp: 'icons/commodities/currency/coin-inset-compass-silver.webp',
        gp: 'icons/commodities/currency/coin-embossed-cobra-gold.webp',
        ep: 'icons/commodities/currency/coin-engraved-oval-steel.webp',
        sp: 'icons/commodities/currency/coin-embossed-unicorn-silver.webp',
        cp: 'icons/commodities/currency/coin-oval-rune-copper.webp'
    };

    // Find existing currency item in the actor's inventory
    const existingItem = actor.items.find(item => item.name === currencyNameMap[currencyType]);

    if (existingItem) {
        // Update the quantity if the currency item already exists
        const currentQuantity = parseInt(existingItem.system.quantity) || 0;
        const newQuantity = currentQuantity + quantity;
        await existingItem.update({ 'system.quantity': newQuantity });
        console.log(`Updated ${currencyNameMap[currencyType]}: ${currentQuantity} -> ${newQuantity}`);
    } else {
        // Create a new currency item if it doesn't exist
        const newItemData = {
            name: currencyNameMap[currencyType],
            type: 'currency',
            img: currencyImgMap[currencyType],
            system: {
                quantity: quantity,
                cost: {
                    currency: currencyType
                },
                attributes: {
                    identified: true,
                    magic: false
                }
            }
        };
        await actor.createEmbeddedDocuments('Item', [newItemData]);
        console.log(`Created new currency item: ${JSON.stringify(newItemData)}`);
    }
}

/**
 * Give currency to actor based on the change.
 *
 * @param {Object} actor - The actor to whom the change will be given.
 * @param {Object} change - The change to be given, structured as { cp: number, sp: number, ep: number, gp: number, pp: number }.
 */
export async function giveCurrency(actor, change) {
    for (const currencyType of Object.keys(change)) {
        if (change[currencyType] > 0) {
            await addCurrencyToActor(actor, currencyType, change[currencyType]);
        }
    }
    console.log(`Added change to actor: ${JSON.stringify(change)}`);
}

/**
 * Pay for something using costInBase (copper value).
 *
 * @param {Object} actor - The actor from whom the amount will be deducted.
 * @param {number} costInBase - The total cost in base currency (copper).
 * @param {string} costCurrency - The currency type for the cost.
 * @return {Object} - An object containing the currencies spent and change remaining.
 */
export async function payCopperBase(actor, costInBase, costCurrency) {
    const carriedCurrency = actor.items.filter(item => item.type === "currency");

    const updateList = [];
    const deleteList = [];
    const addList = [];

    let spentCurrency = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
    let change = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };

    let costRemaining = costInBase;
    let totalUsed = 0;

    console.log(`Starting payment process. Total cost in copper: ${costInBase}`);

    for (const currencyType of Object.keys(currencyBaseExchange).reverse()) {
        for (const coinItem of carriedCurrency) {
            const currencyTypeLower = coinItem.system.cost.currency.toLowerCase();
            if (currencyType !== currencyTypeLower) continue;

            const quantity = parseInt(coinItem.system.quantity) || 0;
            const itemBaseValue = quantity * currencyBaseExchange[currencyType];

            console.log(`Checking ${quantity} ${currencyType} coins with total value ${itemBaseValue} copper.`);

            if (itemBaseValue <= costRemaining) {
                spentCurrency[currencyType] += quantity;
                totalUsed += itemBaseValue;
                costRemaining -= itemBaseValue;
                deleteList.push(coinItem.id);
                console.log(`Used ${quantity} ${currencyType} coins. Remaining cost: ${costRemaining} copper.`);
            } else if (itemBaseValue > costRemaining) {
                const neededCoins = Math.ceil(costRemaining / currencyBaseExchange[currencyType]);
                const remainingCoins = quantity - neededCoins;
                spentCurrency[currencyType] += neededCoins;
                totalUsed += neededCoins * currencyBaseExchange[currencyType];
                costRemaining = 0;

                if (remainingCoins > 0) {
                    updateList.push({
                        item: coinItem,
                        quantity: remainingCoins,
                    });
                } else {
                    deleteList.push(coinItem.id);
                }
                console.log(`Used ${neededCoins} ${currencyType} coins. Remaining cost: 0 copper.`);
            }

            if (costRemaining === 0) break;
        }
        if (costRemaining === 0) break;
    }

    // Calculate and give change if totalUsed is greater than costInBase
    let changeRemaining = totalUsed - costInBase;
    console.log(`Total used: ${totalUsed} copper. Cost in copper: ${costInBase}. Change remaining: ${changeRemaining} copper.`);

    if (changeRemaining > 0) {
        for (const currencyType of Object.keys(currencyBaseExchange)) {
            const coinValue = currencyBaseExchange[currencyType];
            if (changeRemaining >= coinValue) {
                const numCoins = Math.floor(changeRemaining / coinValue);
                change[currencyType] += numCoins;
                changeRemaining -= numCoins * coinValue;
            }
        }
    }

    for (const { item, quantity } of updateList) {
        await item.update({ 'system.quantity': quantity });
    }
    if (deleteList.length) {
        await actor.deleteEmbeddedDocuments('Item', deleteList);
    }

    // Add change to actor's inventory
    await giveCurrency(actor, change);

    console.log(`Payment completed. Spent currency: ${JSON.stringify(spentCurrency)}. Change: ${JSON.stringify(change)}.`);

    return { spent: spentCurrency, change };
}

/**
 * Searches loaded compendiums for items of type "currency" and returns the matching items.
 */
async function findCurrencyItems() {
    const currencyNames = ["Platinum Coins", "Gold Coins", "Electrum Coins", "Silver Coins", "Copper Coins"];
    const compendiums = game.packs.filter(p => p.documentName === "Item");
    let currencyItems = [];

    // Suppress unwanted logs
    const originalConsoleLog = console.log;
    console.log = function() {};

    try {
        for (const compendium of compendiums) {
            const content = await compendium.getDocuments();
            const items = content.filter(item => item.type === "currency" && currencyNames.includes(item.name));
            currencyItems = currencyItems.concat(items);
        }
    } finally {
        // Restore the original console.log function
        console.log = originalConsoleLog;
    }

    if (currencyItems.length === 0) {
        ui.notifications.warn("No specified currency items found.");
    }

    return currencyItems;
}

/**
 * Give currency to actor of amount copperBaseGiven as copperBase.
 *
 * @param {Object} actor - The actor to whom the amount will be given.
 * @param {number} copperBaseGiven - The total amount in base currency (copper).
 * @returns {Object} - An object containing the change given.
 */
export async function giveCurrencyFromCompendium(actor, copperBaseGiven) {
    const currencyItems = await findCurrencyItems();
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

    for (const currencyOrder of currencies) {
        const coinValue = currencyBaseExchange[currencyOrder];
        let count = Math.floor(remainingChange / coinValue);
        if (count > 0) {
            remainingChange -= count * coinValue;
            const coinItem = actor.items.find(coinItem => coinItem.system.cost?.currency?.toLowerCase() === currencyOrder);
            if (coinItem) {
                const quantity = parseInt(coinItem.system.quantity) || 0;
                const newQuantity = quantity + count;
                await coinItem.update({ 'system.quantity': newQuantity });
                console.log(`Updated existing currency item: ${JSON.stringify({ id: coinItem.id, newQuantity })}`);
            } else {
                const currencyData = currencyItems.find(item => item.system.cost.currency.toLowerCase() === currencyOrder);
                if (currencyData) {
                    newCurrencyItems.push({
                        name: currencyData.name,
                        type: 'currency',
                        img: currencyData.img,
                        system: {
                            quantity: count,
                            cost: {
                                currency: currencyOrder,
                            },
                            attributes: {
                                identified: true, // Ensure identified is set to true
                                magic: currencyData.system.attributes?.magic || false, // Retain the 'magic' property if it exists
                            },
                        },
                    });
                    console.log(`Adding new currency item: ${JSON.stringify(currencyData)}`);
                }
            }
        }
    }

    if (newCurrencyItems.length > 0) {
        const createdItems = await actor.createEmbeddedDocuments('Item', newCurrencyItems, {
            hideChanges: true,
        });
        console.log(`Created new currency items: ${JSON.stringify(createdItems)}`);
    }

    return { ...change };
}
