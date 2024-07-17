console.log('shop-subtypres.js is loaded');

// Suppress specific log messages
(function() {
    const originalConsoleLog = console.log;
    console.log = function(message, ...optionalParams) {
        if (typeof message === 'string' && message.includes('ARSItemProficiency migrateData')) {
            return;
        }
        originalConsoleLog.apply(console, [message, ...optionalParams]);
    };
})();

let fetchExecuted = false;

async function updateActorSubtypes(actor) {
    console.log(`Updating subtypes for actor: ${actor.name}`);

    const allowedItemTypes = ["weapon", "armor", "ammunition", "container", "item", "gem", "art", "jewelry", "scroll"];
    const gemNames = [
        'diamond', 'ruby', 'sapphire', 'emerald', 'amethyst', 'topaz', 'opal', 'garnet', 'peridot', 'alexandrite', 'aquamarine', 'bloodstone',
        'citrine', 'moonstone', 'onyx', 'pearl', 'spinel', 'tanzanite', 'turquoise', 'zircon', 'jade', 'amber', 'lapis lazuli', 'malachite', 'agate'
    ];

    const fetchItemDetails = async () => {
        const compendiums = game.packs;
        let itemDetails = [];

        for (let pack of compendiums) {
            if (pack.documentName === "Item") {
                const content = await pack.getDocuments();
                const items = content.filter(item => 
                    item.type === "item" || item.type === "potion" || item.type === "gem" || item.type === "art" || item.type === "jewelry" || item.type === "scroll"
                );
                items.forEach(item => {
                    const { id, name, type, img } = item;
                    let subtype = item.system.attributes?.subtype || 
                        (type === "gem" ? "Gem" : type === "art" ? "Art" : type === "jewelry" ? "Jewelry" : type === "scroll" ? "Scroll" : "Gear");
                    if (item.system.attributes?.magic) {
                        subtype = "Magic";
                    } else if (subtype.toLowerCase() === "other") {
                        subtype = "Gear";
                    }
                    const identified = item.system.attributes?.identified ?? false;
                    const magic = item.system.attributes?.magic ?? false;
                    const costValue = item.system.cost?.value ?? 0;
                    const costCurrency = item.system.cost?.currency ?? "Unknown";

                    itemDetails.push({
                        id: id,
                        name: name,
                        img: img,
                        identified: identified,
                        magic: magic,
                        type: type,
                        subtype: subtype,
                        costValue: costValue,
                        costCurrency: costCurrency
                    });
                });
            }
        }

        itemDetails = itemDetails.map(item => ({
            id: item.id,
            name: item.name,
            img: item.img,
            identified: item.identified,
            magic: item.magic,
            type: item.type,
            subtype: item.subtype,
            costValue: item.costValue,
            costCurrency: item.costCurrency
        }));

        console.log(itemDetails);
        ui.notifications.info(`Found ${itemDetails.length} items with type "item", "potion", "gem", "gear", "art", "jewelry", or "scroll".`);
    };

    if (!fetchExecuted) {
        await fetchItemDetails();
        fetchExecuted = true;
    }

    for (const item of actor.items) {
        const itemType = item.type.toLowerCase();
        const itemName = item.name.toLowerCase();
        let subtype = item.system.attributes?.subtype;

        if (allowedItemTypes.includes(itemType)) {
            let newSubtype = null;

            if (item.system.attributes?.magic) {
                newSubtype = "Magic";
            } else if (itemType === "weapon") {
                newSubtype = "Weapon";
            } else if (itemType === "armor") {
                newSubtype = "Armor";
            } else if (itemType === "ammunition") {
                newSubtype = "Ammunition";
            } else if (itemType === "container") {
                newSubtype = "Container";
            } else if (itemType === "gem" || gemNames.some(gem => itemName.includes(gem))) {
                newSubtype = "Gem";
            } else if (itemType === "art" && !subtype) {
                newSubtype = "Art";
            } else if (itemType === "jewelry" && !subtype) {
                newSubtype = "Jewelry";
            } else if (itemType === "scroll" && !subtype) {
                newSubtype = "Scroll";
            } else if (subtype && subtype.toLowerCase() === "other") {
                newSubtype = "Gear";
            } else if (itemType === "item" && !subtype) {
                newSubtype = "Gear";
            } else if (itemType === "Gear" && !subtype) {
                newSubtype = "Gear";
            }

            if (newSubtype) {
                console.log(`Updating item: ${item.name} to subtype: ${newSubtype}`);
                await item.update({ "system.attributes.subtype": newSubtype });
            }
        }
    }
}

window.updateActorSubtypes = updateActorSubtypes;

Hooks.once('init', () => {
    console.log('shop-subtypres.js initialization hook');
});
