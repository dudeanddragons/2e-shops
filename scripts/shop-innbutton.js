// shop-innbutton.js

console.log('shop-innbutton.js is loaded');

export function setInnMode(html, npcInventory) {
    console.log('Setting shop to inn mode...');
    // Fetch and display inn items
    const innItems = getInnItems(npcInventory);
    console.log('Inn items:', innItems); // Log the inn items for debugging
    setupShopUI(html, innItems);
}

function getInnItems(inventory) {
    return inventory.filter(item => item.subtype === 'Inn' || item.subtype === 'Food' || item.subtype === 'Daily Food and Lodging');
}

function setupShopUI(html, items) {
    const itemsList = html.find("#shop-items-list");
    itemsList.empty();
    items.forEach(item => {
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
