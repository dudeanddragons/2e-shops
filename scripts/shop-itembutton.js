// shop-itembutton.js

console.log('shop-itembutton.js is loaded');

export function showAllItems(html) {
    console.log('Showing all items...');
    // Fetch all items and display them
    const allItems = getAllItems();
    populateItemsList(html, allItems);
}

function getAllItems() {
    return [
        { name: "Battle Axe", quantity: 4, cost: 6, img: "icons/environment/settlement/market-stall.webp" },
        { name: "Throwing Axe", quantity: 25, cost: 6, img: "icons/environment/settlement/market-stall.webp" },
        // More items here
    ];
}

function populateItemsList(html, items) {
    const itemsList = html.find("#shop-items-list");
    itemsList.empty();
    items.forEach(item => {
        itemsList.append(`
            <li>
                <img src="${item.img}" width="36" height="36">
                <span>${item.name} (${item.quantity})</span>
                <span>${item.cost}</span>
            </li>
        `);
    });
}
