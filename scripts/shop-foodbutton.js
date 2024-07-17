// shop-foodbutton.js

console.log('shop-foodbutton.js is loaded');

export function showFoodItems(html) {
    console.log('Showing food items...');
    // Fetch food items and display them
    const foodItems = getFoodItems();
    populateItemsList(html, foodItems);
}

function getFoodItems() {
    return [
        { name: "Bread", quantity: 20, cost: 1, img: "icons/environment/settlement/food-bread.webp" },
        { name: "Cheese", quantity: 10, cost: 2, img: "icons/environment/settlement/food-cheese.webp" },
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
