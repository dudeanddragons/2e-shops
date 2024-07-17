// scripts/init.js

console.log('init.js is being loaded');

Hooks.once('init', () => {
    console.log('Initializing 2e-shops module...');

    game.settings.register('2e-shops', 'cartItems', {
        name: 'Cart Items',
        scope: 'world',
        config: false,
        type: Array,
        default: []
    });

    console.log('2e-shops.cartItems setting registered');
});

Hooks.once('ready', () => {
    console.log('2E Shops module is ready!');
});

Hooks.on('renderActorSheet', (app, html, data) => {
    if (app.actor.type === 'npc') {
        // Add shop tab logic here
    }
});
