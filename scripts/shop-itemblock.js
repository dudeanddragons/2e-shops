// shop-itemblock.js

console.log('shop-itemblock.js is loaded');

export function openItemBlock(actorId, itemId) {
  const actor = game.actors.get(actorId);
  if (!actor) {
    ui.notifications.warn("Actor not found!");
    return;
  }

  const item = actor.items.get(itemId);
  if (!item) {
    ui.notifications.warn("Item not found!");
    return;
  }

  item.sheet.render(true, { tab: "actions" });
}
