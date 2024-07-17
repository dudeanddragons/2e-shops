import { setBuyMode } from './shop-buybutton.js';
import { setSellMode } from './shop-sellbutton.js';
import { setInnMode } from './shop-innbutton.js';
import { setServiceMode } from './shop-servicebutton.js';
import { completeTransaction } from './shop-completebutton.js';
import { ShopMultipliers } from './shop-multipliers.js';
import { addToCart, getCartItems, setCartItems, clearCartItems } from './shop-cartbutton.js';

console.log('shop-buyandsell.js is loaded');

// Define the CustomShopDialog class
class CustomShopDialog extends Dialog {
    constructor(data, options) {
        super(data, options);
    }

    activateListeners(html) {
        super.activateListeners(html);
        // Hide the default close button
        html.closest('.window-app').find('.header-button.close').hide();

        // Add event listener to disable Escape key closing
        $(document).on('keydown.custom-dialog', (event) => {
            if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
            }
        });
    }

    close() {
        // Unbind the custom keydown event when the dialog is closed
        $(document).off('keydown.custom-dialog');
        super.close();
    }

    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        // Remove the close button from the header buttons
        buttons = buttons.filter(button => button.class !== 'close');
        return buttons;
    }
}

// Store the NPC's inventory data
let npcInventory = [];
// Store the player's inventory data
let playerInventory = [];
// Store the cart data
let cart = [];

// Store the actor data
let actorData = {
    id: "",
    img: "",
    name: "",
    type: ""
};

// Function to set ownership for all players
async function setOwnershipForAllPlayers(actorId) {
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
        console.log(`${actor.name} ownership updated to Owner for all players.`);
        return true;
    } catch (err) {
        console.error(err);
        ui.notifications.error(`Failed to update ownership for ${actor.name}`);
        return false;
    }
}

// Function to reset ownership for all players to None
async function resetOwnershipForAllPlayers(actorId) {
    const actor = game.actors.get(actorId);
    if (!actor) {
        ui.notifications.error(`No actor found for actorId: ${actorId}`);
        return false;
    }

    let updateData = {};
    for (const user of game.users) {
        updateData[`ownership.${user.id}`] = 0; // Set ownership to None for all users
    }

    try {
        await actor.update(updateData);
        console.log(`${actor.name} ownership reset to None for all players.`);
        return true;
    } catch (err) {
        console.error(err);
        ui.notifications.error(`Failed to reset ownership for ${actor.name}`);
        return false;
    }
}

async function fetchInventory(actor, isSellMode) {
    console.log(`Fetching inventory for actor ${actor.name}...`);
    console.log(`Actor data:`, actor); // Log the entire actor object to understand its structure

    // Ensure the inventory exists and is an array
    if (!actor.inventory || !Array.isArray(actor.inventory)) {
        console.error('actor.inventory is undefined or not an array');
        return [];
    }

    console.log(`actor.inventory data:`, actor.inventory); // Log the inventory structure

    // Accessing the inventory directly from the actor's inventory
    const inventoryItems = actor.inventory.map(item => {
        console.log(`Processing item with id: ${item.id}, name: ${item.name}`);
        console.log(`ARSActor.Inventory.ARSItem data:`, item); // Log the specific ARSItem
        console.log(`ARSActor.Inventory.ARSItem.System data:`, item.system); // Log the system data of the item

        // Explicit logging to find the correct quantity
        if (!item.system) {
            console.error(`Item system is undefined for item with id: ${item.id}, name: ${item.name}`);
            return null;
        }

        // Fetch the quantity correctly from ARSActor.Inventory.ARSItem.System.quantity
        const quantity = item.system.quantity;
        console.log(`ARSActor.Inventory.ARSItem.System.quantity fetched: ${quantity}`); // Log the quantity fetched

        const adjustedCost = isSellMode 
            ? Math.round(ShopMultipliers.applySellMultiplier(actor, item)) // Use actor for selling
            : Math.round(ShopMultipliers.applyBuyMultiplier(actor, item)); // Use actor for buying

        // Only include items with a cost greater than 0
        if (adjustedCost > 0) {
            return {
                id: item.id,
                name: item.name,
                subtype: item.system.attributes?.subtype || item.type, // Ensure subtype is used
                img: item.img,
                costValue: adjustedCost, // Use adjusted cost
                costCurrency: item.system.cost?.currency || "gp", // Default to "gp" if not specified
                quantity: quantity, // Fetch correct quantity from ARSActor.Inventory.ARSItem.System.quantity
                identified: true, // Default to true
                magic: item.system.magic || false, // Default to false if not specified,
                type: item.type
            };
        }
    }).filter(Boolean); // Filter out undefined values

    console.log(`Retrieved inventory items for actor ${actor.name}:`, inventoryItems);
    return inventoryItems;
}

function storeActorData(actor, type) {
    const data = {
        id: actor.id,
        img: actor.img,
        name: actor.name,
        type: actor.type
    };
    console.log(`${type} Actor Data:`, data);
    return data;
}

function populateItemsList(html, items, isBuyMode) {
    const itemsList = html.find("#shop-items-list");
    itemsList.empty();

    if (isBuyMode) {
        // Filter out items with subtypes "Service" and "Daily Food and Lodging"
        items = items.filter(item => item.subtype !== 'Service' && item.subtype !== 'Daily Food and Lodging');
    }

    items.forEach(item => {
        console.log(`Displaying item: ${item.name}, Quantity: ${item.quantity}`);
        itemsList.append(`
            <style>
                table {
                    width: 100%;
                    border-collapse: collapse; /* Ensure no spacing between cells */
                    margin-bottom: 10px;
                }

                td {
                    padding: 8px;
                    text-align: left;
                    border: none; /* Remove borders */
                }

                .item-select {
                    width: 10px;
                }

                .item-quantity {
                    width: 150px;
                }

                .item-image {
                    width: 40px;
                }

                .item-name {
                    width: 400px;
                    text-align: center; /* Center align contents */
                }

                .item-cost {
                    width: 50px;
                    text-align: right; /* Align cost to the right */
                }
            </style>

            <table>
                <tbody>
                    <tr>
                        <td class="item-select">
                            <input type="checkbox" class="item-checkbox" data-item-id="${item.id}">
                        </td>
                        <td class="item-quantity">
                            <input type="number" class="item-quantity-input" data-item-id="${item.id}" min="1" max="${item.quantity}" value="1">
                        </td>
                        <td class="item-image">
                            <img src="${item.img}" width="36" height="36">
                        </td>
                        <td class="item-name" data-item-id="${item.id}">
                            ${item.name} (${item.quantity})
                        </td>
                        <td class="item-cost">
                            ${item.costValue} ${item.costCurrency}
                        </td>
                    </tr>
                </tbody>
            </table>
        `);
    });
}

function populateCartList(html) {
    const cartList = html.find("#shop-cart-list");
    const cartItems = getCartItems();
    cartList.empty();
    cartItems.forEach(item => {
        cartList.append(`
            <li data-item-id="${item.id}">
                <img src="${item.img}" class="item-image">
                <span class="item-name">${item.name}</span>
                <span class="item-cost">${item.costValue} ${item.costCurrency}</span>
                <button class="remove-button" data-item-id="${item.id}">Remove</button>
            </li>
        `);
    });

    // Add event listener for remove buttons
    cartList.find(".remove-button").off("click").on("click", function() {
        const itemId = $(this).data("item-id");
        handleRemoveFromCart(itemId, html);
    });
}

function handleRemoveFromCart(itemId, html) {
    console.log('Removing item from cart:', itemId);
    const cartItems = getCartItems();
    const updatedCartItems = cartItems.filter(item => item.id !== itemId);
    setCartItems(updatedCartItems);
    updateCartUI(html);
    console.log('Cart items after removing:', getCartItems());
}

function updateCartUI(html) {
    populateCartList(html);
    const totalCost = getCartItems().reduce((sum, item) => sum + item.costValue * item.quantity, 0);
    html.find("#total-cost").text(totalCost);
}

function updateHeaderText(html, isSellMode, npcName) {
    const headerText = isSellMode ? `Selling to ${npcName}` : `Buying from ${npcName}`;
    html.find(".shop-name span").text(headerText);
}

function updateActorImages(html, isSellMode, playerImg, npcImg) {
    if (isSellMode) {
        html.find("#npc-image").attr("src", playerImg);
        html.find("#player-image").attr("src", npcImg);
    } else {
        html.find("#npc-image").attr("src", npcImg);
        html.find("#player-image").attr("src", playerImg);
    }
}

function openItemActionBlock(actor, itemId) {
    const item = actor.items.get(itemId);
    // Open the item sheet to the actions tab
    item.sheet.render(true, { tab: "actions" });
}

function captureSelectedItems(html) {
    const selectedItems = [];
    html.find(".item-checkbox:checked").each(function() {
        const itemId = $(this).data("item-id");
        const quantity = parseInt(html.find(`.item-quantity-input[data-item-id="${itemId}"]`).val(), 10);
        const item = npcInventory.find(i => i.id === itemId) || playerInventory.find(i => i.id === itemId);
        if (item && quantity > 0 && quantity <= item.quantity) {
            selectedItems.push({
                id: item.id,
                name: item.name,
                img: item.img,
                costValue: item.costValue,
                costCurrency: item.costCurrency,
                quantity: quantity,
                identified: true, // Ensure identified is set to true
                magic: item.magic
            });
        }
    });
    return selectedItems;
}

function handleAddToCart(html) {
    console.log('handleAddToCart called');
    const selectedItems = captureSelectedItems(html);
    console.log('Selected items to add to cart:', selectedItems);

    const cartItems = getCartItems();

    selectedItems.forEach(selectedItem => {
        const existingCartItem = cartItems.find(cartItem => cartItem.id === selectedItem.id);

        // Check if adding the selected quantity exceeds the available quantity
        const totalQuantityInCart = existingCartItem ? existingCartItem.quantity + selectedItem.quantity : selectedItem.quantity;
        const availableQuantity = npcInventory.find(i => i.id === selectedItem.id)?.quantity || playerInventory.find(i => i.id === selectedItem.id)?.quantity;

        if (totalQuantityInCart <= availableQuantity) {
            addToCart(html, selectedItem);
        } else {
            console.warn(`Cannot add ${selectedItem.name} to cart. Requested quantity exceeds available quantity.`);
            ui.notifications.warn(`Cannot add ${selectedItem.name} to cart. Requested quantity exceeds available quantity.`);
        }
    });

    // Log the cart items for verification
    console.log('Cart items after adding:', getCartItems());
}

function clearCart(html) {
    console.log('Clearing cart...');
    clearCartItems();
    if (html) {
        updateCartUI(html);
        console.log('Cart cleared');
    } else {
        console.warn('clearCart: html is undefined');
    }
}

function getPlayerCurrency(actor) {
    const currencyItems = actor.items.filter(item => item.type === "currency");
    const currencyCounts = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };

    currencyItems.forEach(item => {
        const quantity = parseInt(item.system.quantity) || 0;
        const currencyType = item.name ? item.name.toLowerCase().includes("platinum") ? "pp" :
            item.name.toLowerCase().includes("gold") ? "gp" :
                item.name.toLowerCase().includes("electrum") ? "ep" :
                    item.name.toLowerCase().includes("silver") ? "sp" :
                        item.name.toLowerCase().includes("copper") ? "cp" : "cp" : "cp";
        if (currencyCounts.hasOwnProperty(currencyType)) {
            currencyCounts[currencyType] += quantity;
        }
    });

    return currencyCounts;
}

function updatePlayerCurrencyUI(html, playerActor) {
    const currencyCounts = getPlayerCurrency(playerActor);
    html.find("#total-copper").html(`
        <span>${currencyCounts.pp} PP <img src="icons/commodities/currency/coin-embossed-unicorn-silver.webp" width="20" height="20"></span>,
        <span>${currencyCounts.gp} GP <img src="icons/commodities/currency/coin-embossed-cobra-gold.webp" width="20" height="20"></span>,
        <span>${currencyCounts.ep} EP <img src="icons/commodities/currency/coin-engraved-oval-steel.webp" width="20" height="20"></span>,
        <span>${currencyCounts.sp} SP <img src="icons/commodities/currency/coin-inset-compass-silver.webp" width="20" height="20"></span>,
        <span>${currencyCounts.cp} CP <img src="icons/commodities/currency/coin-oval-rune-copper.webp" width="20" height="20"></span>
    `);
}

function updateTransactionModeOptions(html, mode) {
    const modeText = {
        buy: "Buy",
        sell: "Sell",
        lodging: "Food and Lodging",
        services: "Services"
    };

    const transactionModeText = modeText[mode] || "Buy";
    html.find(".shop-name span").text(`${transactionModeText}`).addClass('transaction-mode-text');
}

async function openBuyAndSell(playerActor, npcActor) {
    console.log('Opening buy and sell shop interface...');
    console.log(`Player Actor Data:`, playerActor);
    console.log(`NPC Actor Data:`, npcActor);

    try {
        await setOwnershipForAllPlayers(npcActor.id);

        const shopPaths = game.settings.get('2e-shops', 'shopPaths');
        console.log('Using preloaded paths:', shopPaths);

        storeActorData(npcActor, 'NPC');

        const npcMultipliers = await ShopMultipliers.getMultipliers(npcActor);
        console.log(`Multipliers for NPC Actor (ID: ${npcActor.id}, Name: ${npcActor.name}):`, npcMultipliers);

        await ShopMultipliers.copyMultipliersFromNPCToPlayer(npcActor, playerActor);

        storeActorData(playerActor, 'Player');

        const playerMultipliers = await ShopMultipliers.getMultipliers(playerActor);
        console.log(`Multipliers for Player Actor (ID: ${playerActor.id}, Name: ${playerActor.name}):`, playerMultipliers);

        npcInventory = await fetchInventory(npcActor, false);

        playerInventory = await fetchInventory(playerActor, true);

        clearCart();

        const shopDialog = new CustomShopDialog({
            title: `Shop: ${npcActor.name}`,
            content: await renderTemplate(shopPaths.templates.shop, {
                npcActorId: npcActor.id,
                playerActorId: playerActor.id,
                npcName: npcActor.name
            }),
            buttons: {
                close: {
                    label: "Close",
                    callback: async () => {
                        console.log("Shop closed");
                        await resetOwnershipForAllPlayers(npcActor.id);
                    }
                }
            },
            render: (html) => {
                setupShopUI(html, npcActor.name, playerActor.img, npcActor.img, playerActor, npcActor);
                updatePlayerCurrencyUI(html, playerActor);
                // Hide the default close button
                html.closest('.window-app').find('.header-button.close').hide();
                // Set the dialog min-width and max-width
                html.closest('.window-app').css({
                    'min-width': '1600px',
                    'max-width': '1600px'
                });
            },
            options: {
                resizable: true
            }
        });

        shopDialog.render(true);
        
    } catch (error) {
        console.error('Error occurred in openBuyAndSell:', error);
        ui.notifications.error('An error occurred while trying to open the buy and sell interface.');
    }
}

function setupShopUI(html, npcName, playerImg, npcImg, playerActor, npcActor) {
    populateItemsList(html, npcInventory, true);

    let isSellMode = false;

    html.find("#buy-mode").click(() => {
        console.log('Switching to Buy Mode...');
        isSellMode = false;
        populateItemsList(html, npcInventory, true);
        clearCart(html);
        updateHeaderText(html, isSellMode, npcName);
        updateActorImages(html, isSellMode, playerImg, npcImg);
        updateTransactionModeOptions(html, "buy");
        setBuyMode(html);
    });

    html.find("#sell-mode").click(() => {
        console.log('Switching to Sell Mode...');
        isSellMode = true;
        populateItemsList(html, playerInventory, false);
        clearCart(html);
        updateHeaderText(html, isSellMode, npcName);
        updateActorImages(html, isSellMode, playerImg, npcImg);
        updateTransactionModeOptions(html, "sell");
        setSellMode(html);
    });

    html.find("#shop-category-services").click(() => {
        console.log('Services button clicked');
        console.log('Switching to Service Mode...');
        setServiceMode(html, npcInventory);
        updateHeaderText(html, false, npcName);
        updateActorImages(html, false, playerImg, npcImg);
        updateTransactionModeOptions(html, "services");
    });

    html.find("#shop-category-lodging").click(() => {
        console.log('Inn button clicked');
        console.log('Switching to Inn Mode...');
        setInnMode(html, npcInventory);
        updateHeaderText(html, false, npcName);
        updateActorImages(html, false, playerImg, npcImg);
        updateTransactionModeOptions(html, "lodging");
    });

    html.find("#shop-items-list").on('click', '.item-image, .item-name', function() {
        const itemId = $(this).closest('tr').find('input[type="checkbox"]').data("item-id");
        openItemActionBlock(isSellMode ? playerActor : npcActor, itemId);
    });

    html.find("#add-to-cart").click(() => {
        console.log('Add to Cart button clicked...');
        handleAddToCart(html);
    });

    html.find("#shop-done-button").click(() => completeTransaction(html, isSellMode, playerActor, npcActor));

    setBuyMode(html);
    updateHeaderText(html, isSellMode, npcName);
    updateActorImages(html, isSellMode, playerImg, npcImg);
    updateTransactionModeOptions(html, "buy");

    populateCartList(html);
}

// Register the settings and preload paths for GM
Hooks.once('init', () => {
    game.settings.register('2e-shops', 'shopPaths', {
        name: 'Shop Paths',
        scope: 'world',
        config: false,
        type: Object,
        default: {}
    });
});

// Preload paths for GM and set permissions
Hooks.once('ready', async () => {
    console.log('Initializing 2e-shops module...');
    try {
        if (!game.modules.get('2e-shops').api) {
            game.modules.get('2e-shops').api = {};
        }
        game.modules.get('2e-shops').api.openBuyAndSell = openBuyAndSell;
        console.log('2e-shops API:', game.modules.get('2e-shops').api);

        if (game.user.isGM) {
            console.log('Preloading paths for 2E Shops module...');
            
            // Preload paths
            const shopPaths = {
                styles: {
                    shopMultipliers: 'modules/2e-shops/styles/shop-multipliers.css',
                    shop: 'modules/2e-shops/styles/shop.css'
                },
                templates: {
                    shopMultipliers: 'modules/2e-shops/templates/shop-multipliers.html',
                    shop: 'modules/2e-shops/templates/shop.html'
                }
            };

            // Store paths globally for access by player-side scripts
            await game.settings.set('2e-shops', 'shopPaths', shopPaths);
            console.log('Paths preloaded and stored:', shopPaths);

            // Set permissions to "owned" for everyone during initialization
            await setPermissionsToOwnedForEveryone();
        }
    } catch (error) {
        console.error('Error occurred during 2e-shops module initialization:', error);
    }
});

// Function to set permissions to "owned" for everyone
async function setPermissionsToOwnedForEveryone() {
    const shopActors = game.actors.filter(actor => actor.name.includes("Shop"));
    for (const actor of shopActors) {
        const updateData = {};
        for (const user of game.users) {
            updateData[`ownership.${user.id}`] = 3; // Set ownership to "Owner" for everyone
        }
        await actor.update(updateData).then(updatedActor => {
        }).catch(err => {
            console.error(`Failed to update permissions for ${actor.name}`, err);
            ui.notifications.error(`Failed to update permissions for ${actor.name}`);
        });
    }
}

// Function to set NPC permissions to "owned"
async function setNpcPermissionsToOwned(actor) {
    if (actor.ownership?.default !== 3) {
        let updateData = {};
        updateData[`ownership.default`] = 3;
        await actor.update(updateData).then(updatedActor => {
            let newPermissionLevel = updatedActor.ownership.default;
            // ui.notifications.info(`${actor.name} permission updated to ${newPermissionLevel === 3 ? 'Owner' : 'None'}`);
        }).catch(err => {
            console.error(`Failed to update permissions for ${actor.name}`, err);
            ui.notifications.error(`Failed to update permissions for ${actor.name}`);
        });
    }
}

// Register the socketlib module and handle socket events
Hooks.once('socketlib.ready', () => {
    socket = socketlib.registerModule("2e-shops");
    socket.register("executeAsGM", async (fnName, ...args) => {
        if (typeof window[fnName] === "function") {
            return await window[fnName](...args);
        } else {
            console.error(`Function ${fnName} not found on window.`);
        }
    });
});

// Function to run as GM
async function executeAsGM(fnName, ...args) {
    if (game.user.isGM) {
        return await window[fnName](...args);
    } else {
        return await socket.executeAsGM("executeAsGM", fnName, ...args);
    }
}

// Use `executeAsGM` to set NPC permissions before opening the shop
async function openShop(playerActor, npcActor) {
    await executeAsGM("setOwnershipForAllPlayers", npcActor.id);
    openBuyAndSell(playerActor, npcActor);
}

export { openShop };
