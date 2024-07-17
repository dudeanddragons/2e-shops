console.log('shop-cartbutton.js is loaded');

// Initialize socket variable
let socket;
Hooks.once("socketlib.ready", () => {
    socket = socketlib.registerModule("2e-shops");
});

let allItems = [
    // This array should be populated with the actual items available in the shop.
    // Example item structure:
    // { id: 'item1', name: 'Sword', quantity: 10, costValue: 100, costCurrency: 'gp', img: 'path/to/image' }
];

// Use socketlib to execute the function as GM
async function setOwnershipForAllPlayers(actorId) {
    if (!game.user.isGM) {
        return await socket.executeAsGM("setOwnershipForAllPlayers", actorId);
    } else {
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
            return true;
        } catch (err) {
            console.error(err);
            ui.notifications.error(`Failed to update ownership for ${actor.name}`);
            return false;
        }
    }
}

export async function addToCart(html, item) {
    console.log('Adding item to cart...', item);
    clearSelectedCheckboxes();  // Clear checkboxes when adding to cart
    const cartItems = getCartItems();
    const existingItem = cartItems.find(cartItem => cartItem.id === item.id);
    if (existingItem) {
        existingItem.quantity += item.quantity;
    } else {
        cartItems.push(item);
    }
    await setCartItems(cartItems);
    updateCartUI(html);
    updateItemListUI(html);

    // Update ownership for the player's actor
    const selectedActor = canvas.tokens.controlled[0]?.actor;
    if (selectedActor) {
        await setOwnershipForAllPlayers(selectedActor.id);
    }
}

export function getCartItems() {
    return game.settings.get('2e-shops', 'cartItems') || [];
}

export async function setCartItems(items) {
    if (!game.user.isGM) {
        return await socket.executeAsGM("setCartItems", items);
    } else {
        game.settings.set('2e-shops', 'cartItems', items);
    }
}

export async function clearCartItems() {
    console.log('Cart cleared');
    await setCartItems([]);
}

export async function updateCartUI(html) {
    // Ensure html is a DOM element
    if (html instanceof jQuery) {
        html = html[0];
    }

    if (!html || !html.querySelector) {
        console.warn('updateCartUI: html is not a DOM element');
        return;
    }

    const cartList = html.querySelector("#shop-cart-list");
    const cartItems = getCartItems();
    cartList.innerHTML = '';
    cartItems.forEach(item => {
        const listItem = document.createElement('li');
        listItem.dataset.itemId = item.id;
        listItem.innerHTML = `
            <img src="${item.img}" class="item-image">
            <span class="item-name">${item.name} (${item.quantity})</span>
            <span class="item-cost">${item.costValue} ${item.costCurrency}</span>
            <button class="remove-button" data-item-id="${item.id}">Remove</button>
        `;
        cartList.appendChild(listItem);

        // Add event listener for remove button
        listItem.querySelector('.remove-button').addEventListener('click', function() {
            const itemId = this.dataset.itemId;
            handleRemoveFromCart(itemId, html);
        });
    });

    updateTotalCost(html);

    // Update ownership for the player's actor
    const selectedActor = canvas.tokens.controlled[0]?.actor;
    if (selectedActor) {
        await setOwnershipForAllPlayers(selectedActor.id);
    }
}

export async function handleRemoveFromCart(itemId, html) {
    console.log('Removing item from cart:', itemId);
    const cartItems = getCartItems();
    const updatedCartItems = cartItems.filter(item => item.id !== itemId);
    await setCartItems(updatedCartItems);
    updateCartUI(html);
    updateItemListUI(html);
    console.log('Cart items after removing:', getCartItems());

    // Update ownership for the player's actor
    const selectedActor = canvas.tokens.controlled[0]?.actor;
    if (selectedActor) {
        await setOwnershipForAllPlayers(selectedActor.id);
    }
}

export function updateTotalCost(html) {
    // Ensure html is a DOM element
    if (html instanceof jQuery) {
        html = html[0];
    }

    if (!html || !html.querySelector) {
        console.warn('updateTotalCost: html is not a DOM element');
        return;
    }

    const cartItems = getCartItems();
    const totalCostInCopper = cartItems.reduce((total, item) => total + convertToCopper(item.costValue, item.costCurrency) * item.quantity, 0);
    const costBreakdown = calculateCostBreakdown(totalCostInCopper);
    html.querySelector("#total-cost").innerHTML = `
        <span>${costBreakdown.pp} PP <img src="icons/commodities/currency/coin-embossed-unicorn-silver.webp" width="20" height="20"></span>,
        <span>${costBreakdown.gp} GP <img src="icons/commodities/currency/coin-embossed-cobra-gold.webp" width="20" height="20"></span>,
        <span>${costBreakdown.ep} EP <img src="icons/commodities/currency/coin-engraved-oval-steel.webp" width="20" height="20"></span>,
        <span>${costBreakdown.sp} SP <img src="icons/commodities/currency/coin-inset-compass-silver.webp" width="20" height="20"></span>,
        <span>${costBreakdown.cp} CP <img src="icons/commodities/currency/coin-oval-rune-copper.webp" width="20" height="20"></span>
    `;
}

export function convertToCopper(amount, currency) {
    switch (currency.toLowerCase()) {
        case 'pp': return amount * 500;
        case 'gp': return amount * 100;
        case 'ep': return amount * 50;
        case 'sp': return amount * 10;
        case 'cp': return amount;
        default: return amount; // default to copper if unknown currency type
    }
}

export function calculateCostBreakdown(totalCostInCopper) {
    const breakdown = { pp: 0, gp: 0, ep: 0, sp: 0, cp: totalCostInCopper };

    breakdown.pp = Math.floor(breakdown.cp / 500);
    breakdown.cp %= 500;
    breakdown.gp = Math.floor(breakdown.cp / 100);
    breakdown.cp %= 100;
    breakdown.ep = Math.floor(breakdown.cp / 50);
    breakdown.cp %= 50;
    breakdown.sp = Math.floor(breakdown.cp / 10);
    breakdown.cp %= 10;

    return breakdown;
}

export function clearSelectedCheckboxes() {
    console.log('Clearing selected checkboxes');
    const checkboxes = document.querySelectorAll('input[type="checkbox"]:checked');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
}

export async function updateItemListUI(html) {
    // Ensure html is a DOM element
    if (html instanceof jQuery) {
        html = html[0];
    }

    if (!html || !html.querySelector) {
        console.warn('updateItemListUI: html is not a DOM element');
        return;
    }

    const itemList = html.querySelector("#shop-items-list");
    const cartItems = getCartItems();

    allItems.forEach(item => {
        const cartItem = cartItems.find(cartItem => cartItem.id === item.id);
        const availableQuantity = cartItem ? item.quantity - cartItem.quantity : item.quantity;

        let listItem = itemList.querySelector(`[data-item-id="${item.id}"]`);
        if (!listItem) {
            // Create a new list item if it doesn't exist
            listItem = document.createElement('li');
            listItem.dataset.itemId = item.id;
            listItem.innerHTML = `
                <img src="${item.img}" class="item-image">
                <span class="item-name">${item.name} (${availableQuantity})</span>
                <span class="item-cost">${item.costValue} ${item.costCurrency}</span>
                <button class="add-button" data-item-id="${item.id}">Add</button>
            `;
            itemList.appendChild(listItem);

            // Add event listener for add button
            listItem.querySelector('.add-button').addEventListener('click', function() {
                const itemId = this.dataset.itemId;
                const item = allItems.find(item => item.id === itemId);
                addToCart(html, item);
            });
        } else {
            // Update the quantity of the existing list item
            listItem.querySelector('.item-name').textContent = `${item.name} (${availableQuantity})`;
        }
    });

    // Update ownership for the player's actor
    const selectedActor = canvas.tokens.controlled[0]?.actor;
    if (selectedActor) {
        await setOwnershipForAllPlayers(selectedActor.id);
    }
}
